import { db, all } from './db.ts'
import { dayOf } from './config.ts'

// O Hipocampo só mede a partir do dia em que sobe. Mas se o Computer History
// do Codex já registrou trocas de janela, dá para reconstruir os blocos
// daqueles dias — é dado real, não estimativa.
const GAP_OCIOSO = 300

const insert = db.prepare(
  `insert into blocks (started_at, ended_at, seconds, day, app, bundle, title, url, host, idle)
   values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
)

function hostOf(url: string | null): string | null {
  if (!url) return null
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return null }
}

/** Reconstrói os blocos de um dia a partir dos eventos guardados. */
export function backfillDay(day: string): { blocks: number; seconds: number } {
  const existing = db.prepare('select count(*) n from blocks where day = ?').get(day) as { n: number }
  if (existing.n > 0) return { blocks: 0, seconds: 0 }

  const events = all<any>(
    `select ts, kind, app, detail, meta from events where day = ? order by ts, id`, day)
  if (events.length < 5) return { blocks: 0, seconds: 0 }

  type Aberto = { app: string; title: string | null; url: string | null; start: number; last: number }
  let aberto: Aberto | null = null
  let blocks = 0
  let seconds = 0

  const fecha = (fim: number) => {
    if (!aberto) return
    const duracao = Math.max(1, fim - aberto.start)
    insert.run(aberto.start, fim, duracao, day, aberto.app, null, aberto.title,
      aberto.url, hostOf(aberto.url), 0)
    blocks++
    seconds += duracao
    aberto = null
  }

  for (const event of events) {
    const app = event.app ?? 'Desconhecido'

    // Silêncio longo: fecha o que estava aberto e marca o vão como ocioso.
    if (aberto && event.ts - aberto.last > GAP_OCIOSO) {
      const pausa = aberto.last
      fecha(pausa)
      insert.run(pausa, event.ts, event.ts - pausa, day, 'Ocioso', null, null, null, null, 1)
      blocks++
    }

    if (event.kind === 'window') {
      const meta = event.meta ? JSON.parse(event.meta) : {}
      const title = event.detail || null
      if (aberto && aberto.app === app && aberto.title === title) {
        aberto.last = event.ts
        continue
      }
      fecha(event.ts)
      aberto = { app, title, url: meta.url ?? null, start: event.ts, last: event.ts }
      continue
    }

    if (!aberto) {
      aberto = { app, title: null, url: null, start: event.ts, last: event.ts }
      continue
    }
    // Clique ou tecla noutro app significa que o foco mudou sem evento de janela.
    if (aberto.app !== app) {
      fecha(event.ts)
      aberto = { app, title: null, url: null, start: event.ts, last: event.ts }
    } else {
      aberto.last = event.ts
    }
  }
  if (aberto) fecha((aberto as Aberto).last)

  return { blocks, seconds }
}

/** Todos os dias que têm eventos mas nenhum bloco. */
export function backfillAll(): { day: string; blocks: number; seconds: number }[] {
  const days = all<any>(
    `select distinct e.day from events e
      where not exists (select 1 from blocks b where b.day = e.day) order by e.day`)
  return days.map((row) => ({ day: row.day, ...backfillDay(row.day) })).filter((r) => r.blocks > 0)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const result of backfillAll()) {
    console.log(`${result.day}: ${result.blocks} blocos, ${Math.round(result.seconds / 60)} min`)
  }
}
