import fs from 'node:fs/promises'
import path from 'node:path'
import { config, dayOf, projectOf, repoOf, isPlace } from '../config.ts'
import { humanText } from '../prompts.ts'
import { db, getMeta, setMeta } from '../db.ts'
import { redact } from '../redact.ts'
import { exists } from '../guard.ts'

// Each Claude Code session is a .jsonl that only grows. The offset already
// read is stored per file so a round never reprocesses a gigabyte.
const root = path.join(config.home, '.claude', 'projects')

// A request read again keeps its row and takes the project read now: that is
// how the attribution below reaches the requests already stored.
const insert = db.prepare(
  `insert into ai_turns (source_id, ts, day, project, session, prompt, tools) values (?, ?, ?, ?, ?, ?, ?)
   on conflict(source_id) do update set project = excluded.project`,
)

/**
 * The minutes an agent was working, turn by turn.
 *
 * A turn runs from what set the agent going — a question, a tool's result,
 * a notification — to the answer that ends it (`end_turn`). Every minute in
 * between is work, including the minutes a tool was running with no message
 * written: a build, the tests, a wait on CI. Marking only the minutes with a
 * message, as this did before, counted 30 minutes of a morning an agent spent
 * working without a break. The time between the end of a turn and the next
 * question is the agent waiting for the person, and is not counted.
 *
 * A gap longer than this inside a turn is not filled: the session died, or
 * the machine slept, and nobody was working through it.
 */
const LONGEST_STEP = 15 * 60

/**
 * `project` is the repository the session last wrote into. It outlives the
 * turn: a session keeps working where it last wrote until it writes somewhere
 * else, and a question with no file in it is still about that work.
 */
type TurnState = { open: boolean; last: number; project?: string | null }

const updateTools = db.prepare('update ai_turns set tools = ? where source_id = ?')
const updateProject = db.prepare('update ai_turns set project = ? where source_id = ?')

const markMinute = db.prepare(
  `insert into agent_minutes (minute, agent, day, project, events) values (?, 'claude', ?, ?, 1)
   on conflict(minute, agent) do update set events = events + 1, project = excluded.project`,
)

/** The tools that change a file. Reading one is often a reference to another project. */
const WRITES = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit'])

/**
 * The repository an assistant message wrote into, if it wrote into one.
 *
 * The folder a session was opened in says little: one opened in the jarvis
 * folder spent a whole day editing hippocampus, and 144 of that day's 217
 * agent minutes went to a project that had just been retired. The files an
 * agent changes say where the work is.
 */
export function wroteInto(message: any): string | null {
  for (const block of message?.content ?? []) {
    if (block?.type !== 'tool_use' || !WRITES.has(block.name)) continue
    const file = block.input?.file_path ?? block.input?.notebook_path
    const project = typeof file === 'string' ? repoOf(file) : null
    if (project) return project
  }
  return null
}

function textOf(content: unknown): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .filter((block: any) => block?.type === 'text' && typeof block.text === 'string')
    .map((block: any) => block.text)
    .join(' ')
}

/**
 * Reads what is new in the Claude Code sessions: the requests and the tools
 * that ran.
 *
 * Every disk access here is async — see the note on `exists`. A synchronous
 * read inside a folder macOS decides to protect would take the whole collector
 * down, not just this one source.
 */
/**
 * Sessions a Hippocampus core started for itself — writing the journal,
 * answering in the chat — run in its data folder. They are the app at work,
 * not the person's agents, and counting them put the app's own prompts among
 * the person's requests. Any folder holding a hippocampus.db is one: this
 * install's, or another's, like the demo the website is photographed from.
 */
const ownFolders = new Map<string, boolean>()
async function isOwnSession(cwd: string | undefined): Promise<boolean> {
  if (!cwd) return false
  if (!ownFolders.has(cwd)) ownFolders.set(cwd, await exists(path.join(cwd, 'hippocampus.db')))
  return ownFolders.get(cwd)!
}

/** How much of the logs one round reads, so catching up never stalls the collector. */
const ROUND_BUDGET = 200 * 1024 * 1024

// Once: the minutes were counted message by message, and the app's own
// sessions were counted as the person's. Reading every log again from the
// start fills the turns in; requests already stored are not duplicated, since
// each keeps its id. What the app's own sessions left behind goes.
if (getMeta('claude.turns') !== '1') {
  const own = path.basename(config.dataDir)
  db.prepare(`delete from ai_turns where project = ? and source_id not like 'codex:%'`).run(own)
  db.prepare(`delete from agent_minutes where agent = 'claude' and project = ?`).run(own)
  setMeta('claude.offsets', '{}')
  setMeta('claude.turn-state', '{}')
  setMeta('claude.turns', '1')
}

// Once: the project was the name of the folder a session was opened in. Reading
// the logs again from the start puts each minute and each request under the
// repository it wrote into; what is read again is updated in place, and what
// is older than the logs Claude Code keeps stays as it was — nothing is deleted.
// The window labels had learned the same wrong names from the list of known
// projects; the places go, and the app's old name becomes its new one.
if (getMeta('claude.projects') !== '1') {
  setMeta('claude.offsets', '{}')
  setMeta('claude.turn-state', '{}')
  for (const place of ['desktop', 'documents', 'downloads', path.basename(config.home), ...config.codeRoots.map((root) => path.basename(root))]) {
    db.prepare('update labels set project = null where lower(project) = ?').run(place.toLowerCase())
    db.prepare('update ai_turns set project = null where lower(project) = ?').run(place.toLowerCase())
    db.prepare('update agent_minutes set project = null where lower(project) = ?').run(place.toLowerCase())
  }
  // Hipocampo is what this app was called; a label that learned that name
  // means this project.
  db.prepare(`update labels set project = 'hippocampus' where project = 'hipocampo'`).run()
  setMeta('claude.projects', '1')
}

export async function harvestClaudeSessions(): Promise<{ turns: number }> {
  if (!(await exists(root))) return { turns: 0 }
  const offsets = JSON.parse(getMeta('claude.offsets', '{}')) as Record<string, number>
  const states = JSON.parse(getMeta('claude.turn-state', '{}')) as Record<string, TurnState>
  let turns = 0
  let budget = ROUND_BUDGET

  // Every session with something new, the most recently written first: when a
  // round cannot read everything — catching up on a year of logs — today is
  // right at once and the history fills in over the next rounds.
  const pending: { file: string; name: string; project: string | null; size: number; from: number; changed: number }[] = []
  for (const entry of await fs.readdir(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const dir = path.join(root, entry.name)
    // The folder's name is the project path with slashes swapped for hyphens.
    // Only a fallback, for an event with no cwd — and never a place.
    const last = entry.name.split('-').filter(Boolean).pop() ?? entry.name
    const project = isPlace(last) ? null : last
    for (const name of await fs.readdir(dir)) {
      if (!name.endsWith('.jsonl')) continue
      const file = path.join(dir, name)
      const stat = await fs.stat(file)
      const from = offsets[file] ?? 0
      if (stat.size > from) pending.push({ file, name, project, size: stat.size, from, changed: stat.mtimeMs })
    }
  }
  pending.sort((a, b) => b.changed - a.changed)

  for (const { file, name, project, size, from } of pending) {
    if (budget <= 0) break
    budget -= size - from

    const handle = await fs.open(file, 'r')
    const buffer = Buffer.alloc(size - from)
    try {
      await handle.read(buffer, 0, buffer.length, from)
    } finally {
      await handle.close()
    }

    const chunk = buffer.toString('utf8')
    const lastBreak = chunk.lastIndexOf('\n')
    if (lastBreak < 0) continue
    offsets[file] = from + Buffer.byteLength(chunk.slice(0, lastBreak + 1), 'utf8')

    const session = name.replace('.jsonl', '')
    // The tools used are grouped under the human request that set them off.
    let lastPrompt: { id: string; tools: Set<string>; project: string | null } | null = null
    const state = states[file] ?? { open: false, last: 0 }
    states[file] = state
    const lines = chunk.slice(0, lastBreak).split('\n')

    // Whose session it is, decided before any writing: the check touches the
    // disk, and nothing may wait on the disk while a transaction is open.
    const cwdLine = lines.find((line) => line.includes('"cwd":'))
    let cwd: string | undefined
    try { cwd = cwdLine ? JSON.parse(cwdLine).cwd : undefined } catch { cwd = undefined }
    if (await isOwnSession(cwd)) continue

    // One transaction per file: catching up on a year of logs writes
    // hundreds of thousands of minutes, and one commit each would take ages.
    db.exec('begin')
    try {
      for (const line of lines) {
        if (!line.trim()) continue
        let event: any
        try { event = JSON.parse(line) } catch { continue }
        const ts = Math.floor(new Date(event.timestamp).getTime() / 1000)
        if (!Number.isFinite(ts)) continue
        if (event.type !== 'user' && event.type !== 'assistant') continue

        // Where the work is, before any minute is marked: a message that
        // writes into a repository moves the session there from this minute on.
        if (event.type === 'assistant') {
          const wrote = wroteInto(event.message)
          if (wrote) {
            state.project = wrote
            if (lastPrompt && lastPrompt.project !== wrote) {
              updateProject.run(wrote, lastPrompt.id)
              lastPrompt.project = wrote
            }
          }
        }

        // The turn: every minute since the last event, while it is open.
        const where = state.project ?? (event.cwd ? projectOf(event.cwd) : project)
        const minute = Math.floor(ts / 60)
        if (state.open && state.last && ts - state.last <= LONGEST_STEP) {
          for (let m = Math.floor(state.last / 60) + 1; m < minute; m++) markMinute.run(m, dayOf(m * 60), where)
        }
        // A question opens the turn in its own minute: an answer that only
        // starts in the next minute used to leave the minute of the asking out.
        const asks = event.type === 'user' && !state.open
          && !/^\s*\[Request interrupted/.test(textOf(event.message?.content))
        if (state.open || event.type === 'assistant' || asks) markMinute.run(minute, dayOf(ts), where)
        state.last = ts
        if (event.type === 'user') {
          // Stopped by the person: nothing is being worked on until the next question.
          state.open = !/^\s*\[Request interrupted/.test(textOf(event.message?.content))
        } else if (event.message?.stop_reason === 'end_turn') {
          state.open = false
        }

        if (event.type === 'user' && event.origin?.kind === 'human') {
          const prompt = humanText(redact(textOf(event.message?.content)))
          if (!prompt) continue
          const id = `${session}:${event.uuid}`
          insert.run(id, ts, dayOf(ts), where, session, prompt.slice(0, 1200), '[]')
          lastPrompt = { id, tools: new Set(), project: where }
          turns++
        }

        if (event.type === 'assistant' && lastPrompt) {
          for (const block of event.message?.content ?? []) {
            if (block?.type === 'tool_use' && block.name) lastPrompt.tools.add(String(block.name))
          }
          updateTools.run(JSON.stringify([...lastPrompt.tools]), lastPrompt.id)
        }
      }
      db.exec('commit')
    } catch (error) {
      db.exec('rollback')
      throw error
    }
  }

  setMeta('claude.offsets', JSON.stringify(offsets))
  setMeta('claude.turn-state', JSON.stringify(states))
  return { turns }
}
