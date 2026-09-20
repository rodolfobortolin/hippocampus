import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { config, dayOf } from '../config.ts'
import { db } from '../db.ts'

const insert = db.prepare(
  `insert or ignore into commits (sha, repo, ts, day, subject, files, insertions, deletions)
   values (?, ?, ?, ?, ?, ?, ?, ?)`,
)

function git(repo: string, args: string[]): string {
  try {
    return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
  } catch {
    return ''
  }
}

/** Varre os repositórios e guarda os commits dos últimos `days` dias. */
export function harvestGit(days = 3): { commits: number } {
  if (!fs.existsSync(config.codeRoot)) return { commits: 0 }
  let total = 0

  for (const name of fs.readdirSync(config.codeRoot)) {
    const repo = path.join(config.codeRoot, name)
    if (!fs.existsSync(path.join(repo, '.git'))) continue

    // %x1f separa campos e %x1e separa commits: assunto pode ter qualquer coisa.
    const log = git(repo, [
      'log', '--all', '--no-merges', `--since=${days}.days.ago`,
      '--pretty=format:%H%x1f%at%x1f%s%x1e', '--shortstat',
    ])
    if (!log.trim()) continue

    for (const entry of log.split('\x1e')) {
      const [header, ...rest] = entry.split('\n')
      const [sha, at, subject] = header.trim().split('\x1f')
      if (!sha || !at) continue
      const stat = rest.join(' ')
      const files = Number(/(\d+) files? changed/.exec(stat)?.[1] ?? 0)
      const insertions = Number(/(\d+) insertions?/.exec(stat)?.[1] ?? 0)
      const deletions = Number(/(\d+) deletions?/.exec(stat)?.[1] ?? 0)
      const ts = Number(at)
      insert.run(sha, name, ts, dayOf(ts), (subject ?? '').slice(0, 300), files, insertions, deletions)
      total++
    }
  }
  return { commits: total }
}
