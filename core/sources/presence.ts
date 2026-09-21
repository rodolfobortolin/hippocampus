import { spawn } from 'node:child_process'
import readline from 'node:readline'
import { dayOf } from '../config.ts'
import { db } from '../db.ts'

/**
 * When someone was at the Mac, from the power log macOS keeps on its own.
 *
 * Every time a key or the pointer moves after an absence, the window server
 * takes a "user is active" assertion; it lapses after the display-sleep delay
 * with no input, and the log records that too, with the delay. So each
 * assertion is one stretch at the machine: from its creation to the moment it
 * lapsed minus the delay — the last key. On this machine the display-sleep
 * delay is 30 minutes and the log says "00:30:00" on every lapse.
 *
 * It needs no permission, costs nothing while the day happens, and covers the
 * hours the collector was not running. It is not sleep and wake: a Mac kept
 * awake by an app like Amphetamine sleeps three times a week, while the
 * assertion comes and goes several times a day.
 *
 * Only the window server's assertion counts. Other processes take the same
 * kind — Codex's computer use does, for the clicks it makes — and those are
 * not a person at the keyboard.
 */

export type Span = { start: number; end: number }

/**
 * Two stretches touching are one. It also runs on what is read back: once the
 * log rolls over, its oldest stretch begins mid-way and its start is worked
 * out from a summary, which can land a second away from the start stored the
 * week before.
 */
function merge(spans: Span[]): Span[] {
  const merged: Span[] = []
  for (const span of [...spans].sort((a, b) => a.start - b.start)) {
    const last = merged[merged.length - 1]
    if (last && span.start <= last.end + 1) last.end = Math.max(last.end, span.end)
    else merged.push({ start: span.start, end: span.end })
  }
  return merged
}

const LINE = /^(\d{4}-\d\d-\d\d) (\d\d:\d\d:\d\d) ([-+]\d\d)(\d\d) (\S+)\s+(.*)$/
const ASSERTION = /PID \d+\(WindowServer\) (Created|Released|TimedOut|Summary) UserIsActive "[^"]*" (\d+):(\d\d):(\d\d)\s+id:(\S+)/

const at = (date: string, time: string, hours: string, minutes: string) =>
  Math.floor(new Date(`${date}T${time}${hours}:${minutes}`).getTime() / 1000)

/** Reads the output of `pmset -g log` into stretches at the machine, in order. */
export function readPresence(log: string): Span[] {
  const spans: Span[] = []
  let open: { id: string; start: number; seen: number } | null = null
  const close = (end: number) => {
    if (open && end > open.start) spans.push({ start: open.start, end })
    open = null
  }

  for (const line of log.split('\n')) {
    const parts = LINE.exec(line)
    if (!parts) continue
    const [, date, time, hours, minutes, type, message] = parts
    const ts = at(date, time, hours, minutes)

    // Sleep ends it on the spot: the lid closed, the person went with it.
    // The display turning off does not — when that is the idle timer, the
    // last key was a whole delay earlier, and the lapse below says so.
    if (type === 'Sleep' && message.startsWith('Entering Sleep')) { if (open) close(ts); continue }
    if (type !== 'Assertions') continue

    const assertion = ASSERTION.exec(message)
    if (!assertion) continue
    const [, event, h, m, s, id] = assertion
    const held = Number(h) * 3600 + Number(m) * 60 + Number(s)

    if (event === 'Created') {
      // A new one while another is open means the close was never written —
      // a crash or a restart. The old one ends where it was last seen.
      if (open && open.id !== id) close(open.seen)
      if (!open) open = { id, start: ts, seen: ts }
    } else if (event === 'Summary') {
      // The log can begin in the middle of a stretch. The summary says how
      // long the assertion has been held, which is when it began.
      if (!open) open = { id, start: ts - held, seen: ts }
      else open.seen = ts
    } else if (event === 'TimedOut') {
      // Lapsed: the delay has passed since the last input, and the line says
      // how long that delay was.
      if (open) close(Math.max(open.start, ts - held))
    } else if (event === 'Released') {
      if (open) close(ts)
    }
  }
  // Still open at the end of the log: someone is at the machine now. It ends,
  // for the moment, where it was last seen, and grows on the next reading.
  if (open) close((open as { seen: number }).seen)

  return merge(spans)
}

const keep = db.prepare(
  `insert into presence (started_at, ended_at, day) values (?, ?, ?)
   on conflict(started_at) do update set ended_at = excluded.ended_at
   where excluded.ended_at > presence.ended_at`)

/** The lines of the power log this reads, and nothing else: it is 19 MB a week. */
function powerLog(): Promise<string> {
  return new Promise((resolve) => {
    const kept: string[] = []
    let child
    try {
      child = spawn('pmset', ['-g', 'log'], { stdio: ['ignore', 'pipe', 'ignore'] })
    } catch {
      return resolve('')
    }
    child.on('error', () => resolve(''))
    const lines = readline.createInterface({ input: child.stdout })
    lines.on('line', (line) => {
      if (line.includes('(WindowServer)') ? line.includes('UserIsActive') : / Sleep /.test(line)) kept.push(line)
    })
    lines.on('close', () => resolve(kept.join('\n')))
  })
}

export async function harvestPresence(): Promise<{ presence: number }> {
  if (process.platform !== 'darwin') return { presence: 0 }
  let changed = 0
  for (const span of readPresence(await powerLog())) {
    changed += Number(keep.run(span.start, span.end, dayOf(span.start)).changes)
  }
  return { presence: changed }
}

/** The stretches at the machine on a day, and where the day began and ended. */
export function presenceOf(day: string): { firstAt: number | null; lastAt: number | null; seconds: number; spans: Span[] } {
  const spans = merge(db.prepare(`select started_at start, ended_at end from presence where day = ?`).all(day) as Span[])
  return {
    firstAt: spans[0]?.start ?? null,
    lastAt: spans[spans.length - 1]?.end ?? null,
    seconds: spans.reduce((sum, span) => sum + (span.end - span.start), 0),
    spans,
  }
}
