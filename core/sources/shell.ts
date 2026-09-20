import fs from 'node:fs/promises'
import path from 'node:path'
import { config, dayOf } from '../config.ts'
import { db, getMeta, setMeta } from '../db.ts'
import { redact } from '../redact.ts'

// With EXTENDED_HISTORY on, zsh writes `: <epoch>:<duration>;<command>`.
// Without it only the bare line is left — then the watermark is the line count
// and the time is the harvest's, which is off by minutes, not by hours.
const historyFile = path.join(config.home, '.zsh_history')

const insert = db.prepare('insert or ignore into shell_cmds (ts, day, cmd) values (?, ?, ?)')

/** The history, or null when it does not exist or cannot be read. */
async function historico(): Promise<string | null> {
  try {
    return await fs.readFile(historyFile, 'latin1')
  } catch {
    return null
  }
}

export async function shellHasTimestamps(): Promise<boolean> {
  const raw = await historico()
  return raw !== null && /^: \d+:\d+;/m.test(raw)
}

export async function harvestShell(): Promise<{ commands: number; timestamped: boolean }> {
  const raw = await historico()
  if (raw === null) return { commands: 0, timestamped: false }
  const lines = raw.split('\n')
  const timestamped = /^: \d+:\d+;/m.test(raw)
  let total = 0

  if (timestamped) {
    const since = Number(getMeta('shell.since', '0'))
    let latest = since
    for (const line of lines) {
      const match = /^: (\d+):\d+;(.*)$/.exec(line)
      if (!match) continue
      const ts = Number(match[1])
      if (!Number.isFinite(ts) || ts <= since) continue
      latest = Math.max(latest, ts)
      const cmd = redact(match[2].trim()).slice(0, 400)
      if (!cmd) continue
      insert.run(ts, dayOf(ts), cmd)
      total++
    }
    setMeta('shell.since', String(latest))
    return { commands: total, timestamped }
  }

  const seen = Number(getMeta('shell.lines', '0'))
  // The history may have been truncated; in that case start over from the end.
  const from = lines.length < seen ? Math.max(0, lines.length - 1) : seen
  const now = Math.floor(Date.now() / 1000)
  for (const line of lines.slice(from)) {
    const cmd = redact(line.trim()).slice(0, 400)
    if (!cmd) continue
    insert.run(now, dayOf(now), cmd)
    total++
  }
  setMeta('shell.lines', String(lines.length))
  return { commands: total, timestamped }
}
