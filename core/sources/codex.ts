import fs from 'node:fs/promises'
import path from 'node:path'
import { config, dayOf } from '../config.ts'
import { db, getMeta, setMeta } from '../db.ts'
import { redact } from '../redact.ts'
import { exists } from '../guard.ts'

/**
 * The Codex sessions, in the same mould as Claude Code's.
 *
 * Each line is a timestamped event. What matters is `response_item` —
 * reasoning, a tool call, a reply — which marks the minute the agent was
 * producing, and the message with role `user`, which is the human request.
 * Without it, half the delegated work on this machine stayed invisible.
 */
const root = path.join(config.home, '.codex', 'sessions')

const markMinute = db.prepare(
  `insert into agent_minutes (minute, agent, day, project, events) values (?, 'codex', ?, ?, 1)
   on conflict(minute, agent) do update set events = events + 1`,
)
const insertTurn = db.prepare(
  `insert or ignore into ai_turns (source_id, ts, day, project, session, prompt, tools)
   values (?, ?, ?, ?, ?, ?, ?)`,
)

export function codexAvailable(): Promise<boolean> {
  return exists(root)
}

// Async like the rest: recursing synchronously through a folder tree is the
// easiest way to freeze the collector inside a directory macOS protects.
async function files(dir: string, found: string[] = []): Promise<string[]> {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) await files(full, found)
    else if (entry.name.endsWith('.jsonl')) found.push(full)
  }
  return found
}

function textOf(conteudo: unknown): string {
  if (typeof conteudo === 'string') return conteudo
  if (!Array.isArray(conteudo)) return ''
  return conteudo
    .filter((block: any) => typeof block?.text === 'string')
    .map((block: any) => block.text)
    .join(' ')
}

export async function harvestCodexSessions(): Promise<{ turns: number; minutes: number }> {
  if (!(await codexAvailable())) return { turns: 0, minutes: 0 }
  const offsets = JSON.parse(getMeta('codex.offsets', '{}')) as Record<string, number>
  let turns = 0
  let minutes = 0

  for (const file of await files(root)) {
    const size = (await fs.stat(file)).size
    const de = offsets[file] ?? 0
    if (size <= de) continue

    const handle = await fs.open(file, 'r')
    const buffer = Buffer.alloc(size - de)
    try {
      await handle.read(buffer, 0, buffer.length, de)
    } finally {
      await handle.close()
    }

    const chunk = buffer.toString('utf8')
    const lastBreak = chunk.lastIndexOf('\n')
    if (lastBreak < 0) continue
    offsets[file] = de + Buffer.byteLength(chunk.slice(0, lastBreak + 1), 'utf8')

    const session = path.basename(file).replace('.jsonl', '')
    let project: string | null = null

    for (const line of chunk.slice(0, lastBreak).split('\n')) {
      if (!line.trim()) continue
      let event: any
      try { event = JSON.parse(line) } catch { continue }
      const ts = Math.floor(new Date(event.timestamp).getTime() / 1000)
      if (!Number.isFinite(ts)) continue
      const payload = event.payload ?? {}

      // The working directory identifies the project and arrives at the start.
      if (payload.cwd) project = path.basename(String(payload.cwd))

      if (event.type === 'response_item') {
        markMinute.run(Math.floor(ts / 60), dayOf(ts), project)
        minutes++

        // A message with role `user` is the human request; `developer` is the system.
        if (payload.type === 'message' && payload.role === 'user') {
          const request = redact(textOf(payload.content).replace(/\s+/g, ' ').trim())
          if (request) {
            insertTurn.run(`codex:${session}:${payload.id ?? event.ordinal}`, ts, dayOf(ts),
              project, session, request.slice(0, 1200), '["codex"]')
            turns++
          }
        }
      }
    }
  }

  setMeta('codex.offsets', JSON.stringify(offsets))
  return { turns, minutes }
}
