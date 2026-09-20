import { db, all } from './db.ts'
import { dayOf } from './config.ts'

// Measurement only starts the day the collector does. But if Codex's Computer
// History already recorded window switches, the blocks of those days can be
// rebuilt — that is real data, not an estimate.
const IDLE_GAP = 300

const insert = db.prepare(
  `insert into blocks (started_at, ended_at, seconds, day, app, bundle, title, url, host, idle)
   values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
)

function hostOf(url: string | null): string | null {
  if (!url) return null
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return null }
}

/** Rebuilds a day's blocks from the stored events. */
export function backfillDay(day: string): { blocks: number; seconds: number } {
  const existing = db.prepare('select count(*) n from blocks where day = ?').get(day) as { n: number }
  if (existing.n > 0) return { blocks: 0, seconds: 0 }

  const events = all<any>(
    `select ts, kind, app, detail, meta from events where day = ? order by ts, id`, day)
  if (events.length < 5) return { blocks: 0, seconds: 0 }

  type Aberto = { app: string; title: string | null; url: string | null; start: number; last: number }
  let openedAt: Aberto | null = null
  let blocks = 0
  let seconds = 0

  const close = (end: number) => {
    if (!openedAt) return
    const duration = Math.max(1, end - openedAt.start)
    insert.run(openedAt.start, end, duration, day, openedAt.app, null, openedAt.title,
      openedAt.url, hostOf(openedAt.url), 0)
    blocks++
    seconds += duration
    openedAt = null
  }

  for (const event of events) {
    const app = event.app ?? 'Desconhecido'

    // A long silence: close what was open and mark the gap as idle.
    if (openedAt && event.ts - openedAt.last > IDLE_GAP) {
      const gap = openedAt.last
      close(gap)
      insert.run(gap, event.ts, event.ts - gap, day, 'Ocioso', null, null, null, null, 1)
      blocks++
    }

    if (event.kind === 'window') {
      const meta = event.meta ? JSON.parse(event.meta) : {}
      const title = event.detail || null
      if (openedAt && openedAt.app === app && openedAt.title === title) {
        openedAt.last = event.ts
        continue
      }
      close(event.ts)
      openedAt = { app, title, url: meta.url ?? null, start: event.ts, last: event.ts }
      continue
    }

    if (!openedAt) {
      openedAt = { app, title: null, url: null, start: event.ts, last: event.ts }
      continue
    }
    // Clique ou key noutro app significa que o focus mudou sem event de janela.
    if (openedAt.app !== app) {
      close(event.ts)
      openedAt = { app, title: null, url: null, start: event.ts, last: event.ts }
    } else {
      openedAt.last = event.ts
    }
  }
  if (openedAt) close((openedAt as Aberto).last)

  return { blocks, seconds }
}

/** Every day that has events but no blocks. */
export function backfillAll(): { day: string; blocks: number; seconds: number }[] {
  const days = all<any>(
    `select distinct e.day from events e
      where not exists (select 1 from blocks b where b.day = e.day) order by e.day`)
  return days.map((row) => ({ day: row.day, ...backfillDay(row.day) })).filter((r) => r.blocks > 0)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const result of backfillAll()) {
    console.log(`${result.day}: ${result.blocks} blocks, ${Math.round(result.seconds / 60)} min`)
  }
}
