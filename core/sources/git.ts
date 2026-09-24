import { execFileSync } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { config, dayOf } from '../config.ts'
import { db, setMeta } from '../db.ts'

const insert = db.prepare(
  `insert or ignore into commits (sha, repo, ts, day, subject, files, insertions, deletions)
   values (?, ?, ?, ?, ?, ?, ?, ?)`,
)

/**
 * One row per piece of work, not per hash.
 *
 * A rebase, an amend or a rewritten history gives the same commit a new hash,
 * and the table used to keep both: the day this repository's messages were
 * translated, 88 commits were counted three times over, once per generation of
 * hashes, and a rebased branch elsewhere counted twice. What survives a rewrite
 * is the author time and the change itself, so that is the fingerprint — the
 * newest hash, name and message replace the old ones.
 *
 * Empty commits stay out of it: two merges in the same second share a
 * fingerprint without being the same work. And the same hash seen from a
 * second checkout (a worktree) keeps the name it already had, rather than
 * flipping back and forth between folders on every harvest.
 */
const sameWork = db.prepare(
  `select id, sha from commits where ts = ? and files = ? and insertions = ? and deletions = ? and files > 0 limit 1`)
const rewrite = db.prepare(`update commits set sha = ?, repo = ?, day = ?, subject = ? where id = ?`)

export function keepCommit(
  sha: string, repo: string, ts: number, subject: string, files: number, insertions: number, deletions: number,
): void {
  const twin = files > 0 ? sameWork.get(ts, files, insertions, deletions) as { id: number; sha: string } | undefined : undefined
  if (twin) {
    if (twin.sha !== sha) rewrite.run(sha, repo, dayOf(ts), subject, twin.id)
    return
  }
  insert.run(sha, repo, ts, dayOf(ts), subject, files, insertions, deletions)
}

const insertBranch = db.prepare(
  `insert or ignore into branches (repo, ts, day, branch, from_branch) values (?, ?, ?, ?, ?)`)

export type BranchMove = { ts: number; from: string | null; to: string }

const SHA = /^[0-9a-f]{7,40}$/

/** The names of shared inboxes, which say nothing about whose account an owner is. */
const SHARED_INBOX = new Set(['contact', 'hello', 'admin', 'support', 'noreply', 'no-reply', 'office', 'sales', 'team'])

/**
 * Branch switches, from `git reflog --date=unix --format=%gd%x1f%gs`.
 *
 * The reflog keeps 90 days of where HEAD pointed, with the time. Only the
 * switches matter here; a checkout of a bare hash is looking at history, not
 * working on something, and is skipped.
 */
export function readReflog(text: string): BranchMove[] {
  const moves: BranchMove[] = []
  for (const line of text.split('\n')) {
    const move = /^HEAD@\{(\d+)\}\x1fcheckout: moving from (\S+) to (\S+)$/.exec(line.trim())
    if (!move || SHA.test(move[3])) continue
    moves.push({ ts: Number(move[1]), from: SHA.test(move[2]) ? null : move[2], to: move[3] })
  }
  return moves
}

const keepRepo = db.prepare(
  `insert into repos (name, main, host, owner, path, worked, seen_at) values (?, ?, ?, ?, ?, ?, ?)
   on conflict(name) do update set main = excluded.main, host = excluded.host, owner = excluded.owner,
     path = excluded.path, worked = excluded.worked, seen_at = excluded.seen_at`)

export type Remote = { host: string; owner: string; path: string }

/**
 * Whose a repository is, from its remote: the host and the first segment of
 * the path — the GitHub or Bitbucket owner, the GitLab group, the Azure
 * DevOps organisation. Whatever sits before the host — a user, a token — is
 * left behind.
 *
 *   git@github.com:acme/api.git              → github.com · acme
 *   https://user:token@bitbucket.org/acme/x  → bitbucket.org · acme
 *   ssh://git@gitlab.acme.io:2222/ops/infra  → gitlab.acme.io · ops
 *   https://dev.azure.com/acme/web/_git/app  → dev.azure.com · acme
 *   git@ssh.dev.azure.com:v3/acme/web/app    → ssh.dev.azure.com · acme
 */
export function parseRemote(url: string): Remote | null {
  const text = url.trim()
  const scp = /^(?:[^@/\s]+@)?([^:/\s]+):(?!\/\/)(.+)$/.exec(text)
  let host: string
  let rest: string
  if (/^[a-z+]+:\/\//i.test(text)) {
    try {
      const address = new URL(text)
      host = address.hostname
      rest = address.pathname
    } catch {
      return null
    }
  } else if (scp) {
    host = scp[1]
    rest = scp[2]
  } else {
    return null
  }
  const segments = rest.replace(/\.git$/, '').split('/').filter(Boolean)
  // Azure's SSH form puts a version before the organisation.
  if (/^v\d+$/.test(segments[0] ?? '') && /azure|visualstudio/.test(host)) segments.shift()
  if (!host || !segments.length) return null
  return { host: host.toLowerCase(), owner: segments[0], path: segments.join('/') }
}

/**
 * The folder of the repository a checkout belongs to: itself, or for a
 * worktree the one that holds its history — from `git rev-parse
 * --git-common-dir`, which ends in that folder's `.git`.
 */
export function mainOf(name: string, commonDir: string): string {
  const dir = commonDir.trim().replace(/\/+$/, '')
  if (!dir) return name
  return dir.endsWith('/.git') ? path.basename(path.dirname(dir)) : path.basename(dir, '.git')
}

/**
 * The GitHub logins signed in on this Mac, from the GitHub CLI's own file:
 * the surest name for "yours" a repository owner can be compared with. Read
 * asynchronously, like everything that touches disk here.
 */
async function signedInLogins(): Promise<string[]> {
  const dir = process.env.GH_CONFIG_DIR || path.join(os.homedir(), '.config', 'gh')
  try {
    const text = await fs.readFile(path.join(dir, 'hosts.yml'), 'utf8')
    return [...text.matchAll(/^\s+user:\s*["']?([\w.-]+)/gm)].map((match) => match[1])
  } catch {
    return []
  }
}

function git(repo: string, args: string[]): string {
  try {
    return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
  } catch {
    return ''
  }
}

/**
 * Walks the repositories and stores the commits of the last `days` days.
 *
 * Everything that touches disk here is async on purpose. The code folder lives
 * in `~/Documents`, which macOS protects: without the permission, a
 * `readdirSync` does not return an error — it stops, and stops the whole
 * collector with it, the server already saying it is up and no route
 * answering. The `withTimeout` wrapped around this function cannot save it,
 * because that timeout also needs the event loop to fire; async is what hands
 * control back to it.
 */
export async function harvestGit(days = 3): Promise<{ commits: number; branches: number }> {
  let names: string[]
  try {
    names = await fs.readdir(config.codeRoot)
  } catch {
    return { commits: 0, branches: 0 }
  }
  let total = 0
  let switches = 0
  // Who the person is, as git and GitHub know them: whose repositories are
  // their own, and not a client's.
  const you = new Set<string>(await signedInLogins())
  const yourDomains = new Set<string>()

  for (const name of names) {
    const repo = path.join(config.codeRoot, name)
    try {
      await fs.access(path.join(repo, '.git'))
    } catch {
      continue
    }

    // Whose it is, and which repository a worktree belongs to. One call for
    // the remotes and the identity, one for where the history lives.
    const settings = git(repo, ['config', '--get-regexp', '^(remote\\..*\\.url|user\\.name|user\\.email)$'])
    const urls = new Map<string, string>()
    const authors: string[] = []
    for (const line of settings.split('\n')) {
      const [key, ...value] = line.split(' ')
      const text = value.join(' ').trim()
      if (!text) continue
      const remote = /^remote\.(.+)\.url$/.exec(key)
      if (remote) urls.set(remote[1], text)
      else if (key === 'user.name') you.add(text)
      else if (key === 'user.email') {
        authors.push(text)
        // A shared inbox's name — contact@, info@ — says nothing about whose
        // account an owner is.
        const local = text.split('@')[0]
        if (local.length >= 5 && !SHARED_INBOX.has(local.toLowerCase())) you.add(local)
        if (text.includes('@')) yourDomains.add(text.split('@')[1].toLowerCase())
      }
    }
    const remote = parseRemote(urls.get('origin') ?? urls.get('upstream') ?? [...urls.values()][0] ?? '')
    const main = mainOf(name, git(repo, ['rev-parse', '--path-format=absolute', '--git-common-dir']))
    const worked = authors.some((author) =>
      git(repo, ['log', '-1', '--all', '--format=%H', '--fixed-strings', `--author=${author}`]).trim() !== '')
    keepRepo.run(name, main, remote?.host ?? null, remote?.owner ?? null, remote?.path ?? null,
      worked ? 1 : 0, Math.floor(Date.now() / 1000))

    // The whole reflog each time: it is a few hundred lines, and a repository
    // with no commit in days can still have been switched to a new branch.
    const reflog = git(repo, ['reflog', '--date=unix', '--format=%gd%x1f%gs'])
    const moves = readReflog(reflog)
    for (const move of moves) {
      switches += Number(insertBranch.run(name, move.ts, dayOf(move.ts), move.to, move.from).changes)
    }
    // A worktree is usually made on its branch and never switched: no
    // checkout in its reflog, and its ticket went unseen. It has been on that
    // branch since its first entry.
    if (!moves.length) {
      const first = Math.min(...[...reflog.matchAll(/^HEAD@\{(\d+)\}/gm)].map((match) => Number(match[1])))
      const branch = git(repo, ['rev-parse', '--abbrev-ref', 'HEAD']).trim()
      if (Number.isFinite(first) && branch && branch !== 'HEAD') {
        switches += Number(insertBranch.run(name, first, dayOf(first), branch, null).changes)
      }
    }

    // %x1f separates fields and %x1e OPENS each commit — it does not close it.
    //
    // With the separator at the end, --shortstat lands on the line after the
    // header and falls inside the next commit's chunk; the parser read the
    // wrong statistic and wrote everything as +0/-0. Opening the record keeps
    // header and statistic in the same chunk.
    const log = git(repo, [
      'log', '--all', '--no-merges', `--since=${days}.days.ago`,
      '--pretty=format:%x1e%H%x1f%at%x1f%s', '--shortstat',
    ])
    if (!log.trim()) continue

    for (const entry of log.split('\x1e')) {
      if (!entry.trim()) continue
      const [header, ...rest] = entry.split('\n')
      const [sha, at, subject] = header.trim().split('\x1f')
      if (!sha || !at) continue
      const stat = rest.join(' ')
      const files = Number(/(\d+) files? changed/.exec(stat)?.[1] ?? 0)
      const insertions = Number(/(\d+) insertions?/.exec(stat)?.[1] ?? 0)
      const deletions = Number(/(\d+) deletions?/.exec(stat)?.[1] ?? 0)
      const ts = Number(at)
      keepCommit(sha, name, ts, (subject ?? '').slice(0, 300), files, insertions, deletions)
      total++
    }
  }
  setMeta('you', JSON.stringify([...you]))
  setMeta('you.domains', JSON.stringify([...yourDomains]))
  return { commits: total, branches: switches }
}

/**
 * The repositories directly inside a folder, for the walkthrough to show
 * what it found. Asynchronous and bounded in time, like the harvest: the
 * folder people pick is often inside ~/Documents, where macOS protects reads,
 * and a synchronous read there freezes the whole core instead of failing.
 */
export async function countRepos(root: string): Promise<{ root: string; repos: number; names: string[]; readable: boolean }> {
  const look = async () => {
    const names = await fs.readdir(root)
    const found: string[] = []
    await Promise.all(names.map(async (name) => {
      try { await fs.access(path.join(root, name, '.git')); found.push(name) } catch { /* not a repository */ }
    }))
    return found.sort()
  }
  try {
    const found = await Promise.race([
      look(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
    ])
    return { root, repos: found.length, names: found.slice(0, 8), readable: true }
  } catch {
    return { root, repos: 0, names: [], readable: false }
  }
}
