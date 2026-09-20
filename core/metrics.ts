import { all, one } from './db.ts'
import { config, dayOf } from './config.ts'

export type AppSlice = { app: string; seconds: number; category: string | null }
export type Slice = { name: string; seconds: number }
export type TimelineBlock = {
  start: number; end: number; app: string; title: string | null
  category: string | null; idle: number; focus: number | null
}

// A chave do rótulo normaliza dígitos, então a junção com o jev acontece em JS,
// pelo mesmo normalizador que gravou o rótulo.
import { labelKey, cachedLabel } from './jev.ts'

function labelOf(row: { app: string | null; title: string | null; host: string | null }) {
  return cachedLabel(labelKey(row))
}

export function dayReport(day: string) {
  const blocks = all<any>(
    `select id, started_at, ended_at, seconds, app, bundle, title, url, host, idle
       from blocks where day = ? order by started_at`, day)

  const active = blocks.filter((b) => !b.idle)
  const activeSeconds = active.reduce((sum, b) => sum + b.seconds, 0)
  const idleSeconds = blocks.filter((b) => b.idle).reduce((sum, b) => sum + b.seconds, 0)

  const apps = new Map<string, number>()
  const categories = new Map<string, number>()
  const projects = new Map<string, number>()
  const windows = new Map<string, { app: string; seconds: number }>()
  let focusWeighted = 0

  for (const block of active) {
    const label = labelOf(block)
    apps.set(block.app, (apps.get(block.app) ?? 0) + block.seconds)
    const category = label?.category ?? 'sem rótulo'
    categories.set(category, (categories.get(category) ?? 0) + block.seconds)
    if (label?.project) projects.set(label.project, (projects.get(label.project) ?? 0) + block.seconds)
    focusWeighted += block.seconds * (label?.deep_work ?? 0.5)
    if (block.title) {
      const key = `${block.app}|${block.title}`
      const seen = windows.get(key) ?? { app: block.app, seconds: 0 }
      seen.seconds += block.seconds
      windows.set(key, seen)
    }
  }

  // Trocas de app: quantas vezes o foco mudou de aplicativo ao longo do dia.
  let switches = 0
  let previous = ''
  for (const block of active) {
    if (block.app !== previous) { switches++; previous = block.app }
  }

  // A fita do dia: blocos curtos viram ruído, então some vizinhos do mesmo app.
  const timeline: TimelineBlock[] = []
  for (const block of blocks) {
    const label = block.idle ? null : labelOf(block)
    const last = timeline[timeline.length - 1]
    if (last && last.app === block.app && block.started_at - last.end <= 90) {
      last.end = block.ended_at
      continue
    }
    timeline.push({
      start: block.started_at, end: block.ended_at, app: block.app, title: block.title,
      category: label?.category ?? null, idle: block.idle, focus: label?.deep_work ?? null,
    })
  }

  const sortSlices = (map: Map<string, number>): Slice[] =>
    [...map].map(([name, seconds]) => ({ name, seconds })).sort((a, b) => b.seconds - a.seconds)

  const bounds = one<any>(
    `select min(started_at) first_at, max(ended_at) last_at from blocks where day = ? and idle = 0`, day)

  return {
    day,
    activeSeconds,
    idleSeconds,
    focusRatio: activeSeconds ? focusWeighted / activeSeconds : 0,
    switches,
    firstAt: bounds?.first_at ?? null,
    lastAt: bounds?.last_at ?? null,
    apps: sortSlices(apps).slice(0, 14),
    categories: sortSlices(categories),
    projects: sortSlices(projects).slice(0, 10),
    windows: [...windows].map(([key, value]) => ({
      title: key.split('|').slice(1).join('|'), app: value.app, seconds: value.seconds,
    })).sort((a, b) => b.seconds - a.seconds).slice(0, 12),
    timeline: timeline.filter((b) => b.end - b.start >= 20),
    shortcuts: all<any>(
      `select detail as name, count(*) as n from events
        where day = ? and kind = 'shortcut' and detail <> '' group by detail order by n desc limit 10`, day),
    clicks: one<any>(`select count(*) n from events where day = ? and kind in ('click','drag')`, day)?.n ?? 0,
    typing: one<any>(`select coalesce(sum(chars),0) chars, count(*) samples from typing where day = ?`, day),
    commits: all<any>(
      `select repo, subject, ts, insertions, deletions from commits where day = ? order by ts`, day),
    hosts: all<any>(
      `select host as name, count(*) n from visits where day = ? and host <> '' group by host order by n desc limit 10`, day),
    visits: one<any>(`select count(*) n from visits where day = ?`, day)?.n ?? 0,
    aiTurns: all<any>(
      `select project, prompt, tools, ts from ai_turns where day = ? order by ts`, day),
    stored: one<any>(
      `select active_seconds, focus_ratio, narrative, recap, built_at from days where day = ?`, day) ?? null,
  }
}

export type DayReport = ReturnType<typeof dayReport>

/** Totais por dia num intervalo, para tendência e listagem. */
export function rangeReport(from: string, to: string) {
  const days = all<any>(
    `select day,
            sum(case when idle = 0 then seconds else 0 end) as active,
            sum(case when idle = 1 then seconds else 0 end) as idle
       from blocks where day between ? and ? group by day order by day`, from, to)

  const stored = new Map(
    all<any>(`select day, focus_ratio, narrative, recap from days where day between ? and ?`, from, to)
      .map((row) => [row.day, row]))

  return days.map((row) => ({
    ...row,
    focusRatio: stored.get(row.day)?.focus_ratio ?? null,
    hasNarrative: Boolean(stored.get(row.day)?.narrative),
  }))
}

/** Mapa hora × dia da semana, em segundos ativos. */
export function heatmap(from: string, to: string) {
  const rows = all<any>(
    `select started_at, seconds from blocks where day between ? and ? and idle = 0`, from, to)
  const grid = Array.from({ length: 7 }, () => new Array(24).fill(0))
  for (const row of rows) {
    const date = new Date(row.started_at * 1000)
    grid[date.getDay()][date.getHours()] += row.seconds
  }
  return grid
}

/** Projetos conhecidos: repositórios do disco mais o que o Claude Code tocou. */
export function knownProjects(): string[] {
  const fromAi = all<any>(
    `select project, count(*) n from ai_turns where project is not null group by project order by n desc limit 20`)
    .map((row) => row.project)
  const fromGit = all<any>(`select distinct repo from commits`).map((row) => row.repo)
  return [...new Set([...fromAi, ...fromGit])].filter(Boolean)
}

export function overview() {
  const day = dayOf(new Date())
  const counts = one<any>(`
    select (select count(*) from blocks) blocks,
           (select count(*) from events) events,
           (select count(*) from visits) visits,
           (select count(*) from ai_turns) ai,
           (select count(*) from commits) commits,
           (select count(*) from typing) typing,
           (select count(*) from labels) labels,
           (select count(distinct day) from blocks) days`)
  const span = one<any>(`select min(day) de, max(day) ate from visits`)
  return { day, counts, span, dayStartHour: config.dayStartHour }
}

/** Agregado de um intervalo inteiro: onde o tempo foi na semana, no mês. */
export function periodSummary(from: string, to: string) {
  const blocks = all<any>(
    `select app, title, host, seconds from blocks where day between ? and ? and idle = 0`, from, to)

  const apps = new Map<string, number>()
  const categories = new Map<string, number>()
  const projects = new Map<string, number>()
  let total = 0
  let focusWeighted = 0

  for (const block of blocks) {
    const label = labelOf(block)
    total += block.seconds
    apps.set(block.app, (apps.get(block.app) ?? 0) + block.seconds)
    const category = label?.category ?? 'sem rótulo'
    categories.set(category, (categories.get(category) ?? 0) + block.seconds)
    if (label?.project) projects.set(label.project, (projects.get(label.project) ?? 0) + block.seconds)
    focusWeighted += block.seconds * (label?.deep_work ?? 0.5)
  }

  const slices = (map: Map<string, number>, limit: number) =>
    [...map].map(([name, seconds]) => ({ name, seconds })).sort((a, b) => b.seconds - a.seconds).slice(0, limit)

  return {
    total,
    focusRatio: total ? focusWeighted / total : 0,
    apps: slices(apps, 12),
    categories: slices(categories, 10),
    projects: slices(projects, 10),
    shortcuts: all<any>(
      `select detail as name, count(*) as n from events where kind = 'shortcut' and day between ? and ?
        and detail <> '' group by detail order by n desc limit 12`, from, to),
    hosts: all<any>(
      `select host as name, count(*) as n from visits where day between ? and ? and host <> ''
        group by host order by n desc limit 12`, from, to),
    typing: one<any>(
      `select coalesce(sum(chars),0) chars, count(*) samples from typing where day between ? and ?`, from, to),
    commits: one<any>(`select count(*) n from commits where day between ? and ?`, from, to)?.n ?? 0,
    aiTurns: one<any>(`select count(*) n from ai_turns where day between ? and ?`, from, to)?.n ?? 0,
  }
}
