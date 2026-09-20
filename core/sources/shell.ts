import fs from 'node:fs'
import path from 'node:path'
import { config, dayOf } from '../config.ts'
import { db, getMeta, setMeta } from '../db.ts'
import { redact } from '../redact.ts'

// Com EXTENDED_HISTORY ligado o zsh grava `: <epoch>:<duração>;<comando>`.
// Sem isso sobra a linha nua — aí a marca d'água é a contagem de linhas e a
// hora é a da coleta, que erra por minutos, não por horas.
const historyFile = path.join(config.home, '.zsh_history')

const insert = db.prepare('insert or ignore into shell_cmds (ts, day, cmd) values (?, ?, ?)')

export function shellHasTimestamps(): boolean {
  if (!fs.existsSync(historyFile)) return false
  const raw = fs.readFileSync(historyFile, 'latin1')
  return /^: \d+:\d+;/m.test(raw)
}

export function harvestShell(): { commands: number; timestamped: boolean } {
  if (!fs.existsSync(historyFile)) return { commands: 0, timestamped: false }
  const raw = fs.readFileSync(historyFile, 'latin1')
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
  // O histórico pode ter sido truncado; nesse caso recomeça do fim.
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
