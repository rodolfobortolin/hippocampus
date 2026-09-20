import { execFileSync } from 'node:child_process'
import fs from 'node:fs/promises'
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
export async function harvestGit(days = 3): Promise<{ commits: number }> {
  let names: string[]
  try {
    names = await fs.readdir(config.codeRoot)
  } catch {
    return { commits: 0 }
  }
  let total = 0

  for (const name of names) {
    const repo = path.join(config.codeRoot, name)
    try {
      await fs.access(path.join(repo, '.git'))
    } catch {
      continue
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
      insert.run(sha, name, ts, dayOf(ts), (subject ?? '').slice(0, 300), files, insertions, deletions)
      total++
    }
  }
  return { commits: total }
}
