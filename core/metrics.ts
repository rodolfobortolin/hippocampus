import { all, one } from './db.ts'
import { presenceOf } from './sources/presence.ts'
import { config, dayOf } from './config.ts'

export type AppSlice = { app: string; seconds: number; category: string | null }
export type Slice = { name: string; seconds: number }
export type TimelineBlock = {
  start: number; end: number; app: string; title: string | null
  category: string | null; idle: number; focus: number | null
  delegado: boolean
}

// The label's key normalises digits, so the join with jev happens in JS, by
// the same normaliser that wrote the label.
import { labelKey, cachedLabel } from './jev.ts'

/**
 * Categorias onde trabalho concentrado acontece.
 *
 * Focus is defined here, in code, and not by jev's `deep_work` probability.
 * jev. Medindo de verdade, aquela probabilidade fica espremida entre 0,34 e
 * That probability sits around 0.67 — even "code" scores 0.65 — because a
 * window title is not enough to judge concentration, and the model answers
 * with the uncertainty it genuinely has. Using its average as "% focus" would
 * present an average of probabilities as a fraction of time, which is a
 * different thing. The category, though, jev gets right with high confidence,
 * and the rule below is readable and arguable.
 */
const FOCUS_CATEGORIES = new Set(['code', 'ai', 'writing', 'design', 'research'])

export const isFocus = (categoria: string | null | undefined) =>
  FOCUS_CATEGORIES.has(categoria ?? '')

function labelOf(row: { app: string | null; title: string | null; host: string | null }) {
  return cachedLabel(labelKey(row))
}

/**
 * The minutes in which an agent was working that day.
 *
 * This separates two things the clock confuses: time at a standstill because
 * you left, and time at a standstill because you delegated. Whoever works with
 * agents produces plenty away from the keyboard, and calling that idleness is
 * measuring it wrong.
 */
function agentMinutes(day: string): Set<number> {
  return new Set(
    all<any>('select minute from agent_minutes where day = ?', day).map((r) => r.minute as number))
}

/** How many seconds of a range fall into minutes with an agent active. */
function delegatedSeconds(start: number, end: number, ativos: Set<number>): number {
  let total = 0
  for (let minute = Math.floor(start / 60); minute <= Math.floor(end / 60); minute++) {
    if (!ativos.has(minute)) continue
    const de = Math.max(start, minute * 60)
    const to = Math.min(end, (minute + 1) * 60)
    total += Math.max(0, to - de)
  }
  return total
}

export function dayReport(day: string) {
  const blocks = all<any>(
    `select id, started_at, ended_at, seconds, app, bundle, title, url, host, idle
       from blocks where day = ? order by started_at`, day)

  const active = blocks.filter((b) => !b.idle)
  const activeSeconds = active.reduce((sum, b) => sum + b.seconds, 0)
  const idleBlocks = blocks.filter((b) => b.idle)
  const idleSeconds = idleBlocks.reduce((sum, b) => sum + b.seconds, 0)

  // O tempo parado se parte em dois: delegado (agente trabalhando) e ausente.
  const agents = agentMinutes(day)
  const delegated = idleBlocks.reduce(
    (sum, b) => sum + delegatedSeconds(b.started_at, b.ended_at, agents), 0)

  const apps = new Map<string, number>()
  const categories = new Map<string, number>()
  const projects = new Map<string, number>()
  const windows = new Map<string, { app: string; seconds: number }>()
  let focusSeconds = 0

  for (const block of active) {
    const label = labelOf(block)
    apps.set(block.app, (apps.get(block.app) ?? 0) + block.seconds)
    const category = label?.category ?? 'unlabelled'
    categories.set(category, (categories.get(category) ?? 0) + block.seconds)
    if (label?.project) projects.set(label.project, (projects.get(label.project) ?? 0) + block.seconds)
    if (isFocus(label?.category)) focusSeconds += block.seconds
    if (block.title) {
      const key = `${block.app}|${block.title}`
      const seen = windows.get(key) ?? { app: block.app, seconds: 0 }
      seen.seconds += block.seconds
      windows.set(key, seen)
    }
  }

  // Trocas de app: quantas vezes o focus mudou de aplicativo ao longo do day.
  // The first block is not a switch — starting work is not switching. Beyond
  // the total, this separates the cheap switch (same project) from the costly
  // one (changes project), which is the only one that maps to attention residue.
  let switches = 0
  let switchesProject = 0
  let previous: string | null = null
  let previousProject: string | null | undefined
  for (const block of active) {
    const project = labelOf(block)?.project ?? null
    if (previous !== null && block.app !== previous) {
      switches++
      if (previousProject !== undefined && project !== previousProject) switchesProject++
    }
    previous = block.app
    previousProject = project
  }

  // The day's ribbon: short blocks become noise, so neighbours of the same app merge.
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
      // An idle stretch with an agent working is drawn differently: it is not a hole in the day.
      delegado: block.idle
        ? delegatedSeconds(block.started_at, block.ended_at, agents) > (block.seconds * 0.4)
        : false,
    })
  }

  const sortSlices = (map: Map<string, number>): Slice[] =>
    [...map].map(([name, seconds]) => ({ name, seconds })).sort((a, b) => b.seconds - a.seconds)

  const bounds = one<any>(
    `select min(started_at) first_at, max(ended_at) last_at from blocks where day = ? and idle = 0`, day)
  // The day began when someone sat down, not when the collector noticed:
  // macOS's own record of input covers the hours it was not running.
  const presence = presenceOf(day)
  const earliest = (a: number | null, b: number | null) => (a && b ? Math.min(a, b) : a ?? b)
  const latest = (a: number | null, b: number | null) => (a && b ? Math.max(a, b) : a ?? b)
  const sessions = focusSessions(day)

  return {
    day,
    sessions,
    focusShape: focusShape(sessions),
    activeSeconds,
    idleSeconds,
    delegatedSeconds: delegated,
    awaySeconds: Math.max(0, idleSeconds - delegated),
    agentMinutes: agents.size,
    focusSeconds,
    focusRatio: activeSeconds ? focusSeconds / activeSeconds : 0,
    switches,
    switchesProject,
    firstAt: earliest(bounds?.first_at ?? null, presence.firstAt),
    lastAt: latest(bounds?.last_at ?? null, presence.lastAt),
    presence: { seconds: presence.seconds, stretches: presence.spans.length },
    apps: sortSlices(apps).slice(0, 14),
    categories: sortSlices(categories),
    projects: sortSlices(projects).slice(0, 10),
    windows: [...windows].map(([key, value]) => ({
      title: key.split('|').slice(1).join('|'), app: value.app, seconds: value.seconds,
    })).sort((a, b) => b.seconds - a.seconds).slice(0, 12),
    // Under 20s a stretch does not reach a pixel on the ribbon; it drops out of
    // the drawing, but the count stays visible so the day never looks tidier
    // than it was.
    timeline: timeline.filter((b) => b.end - b.start >= 20),
    timelineHidden: timeline.filter((b) => b.end - b.start < 20).length,
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
    // Keys, clicks and scroll as the system counts them — no permission and no
    // storing what was typed. It is what separates writing from reading.
    input: one<any>(
      `select coalesce(sum(keys),0) keys, coalesce(sum(clicks),0) clicks,
              coalesce(sum(scroll),0) scroll from blocks where day = ?`, day),
    inputPerApp: all<any>(
      `select app, sum(keys) keys, sum(clicks) clicks, sum(scroll) scroll
         from blocks where day = ? and idle = 0
        group by app having keys + clicks + scroll > 20
        order by keys + clicks desc limit 8`, day),
    // Sound playing with the microphone idle is media; with the microphone
    // active it is a call. Our own listener's microphone was already discounted
    // at collection time.
    soundtrack: one<any>(
      `select coalesce(sum(case when sound = 1 and mic = 0 then seconds else 0 end), 0) seconds,
              coalesce(sum(case when mic = 1 then seconds else 0 end), 0) inCall
         from blocks where day = ? and idle = 0`, day),
    media: all<any>(
      `select media as name, sum(seconds) seconds from blocks
        where day = ? and idle = 0 and media is not null and sound = 1
        group by media order by seconds desc`, day),
    screens: all<any>(
      `select screen as name, sum(seconds) seconds from blocks
        where day = ? and idle = 0 and screen is not null
        group by screen order by seconds desc`, day),
    aiTurns: all<any>(
      `select project, prompt, tools, ts from ai_turns where day = ? order by ts`, day),
    stored: one<any>(
      `select active_seconds, focus_ratio, narrative, recap, built_at from days where day = ?`, day) ?? null,
  }
}

export type DayReport = ReturnType<typeof dayReport>

/** Totals per day over a range, for the trend and the listing. */
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

/** An hour × weekday map, in active seconds. */
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

/** Known projects: repositories on disk plus whatever Claude Code touched. */
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
  const span = one<any>(`select min(day) first_day, max(day) last_day from visits`)
  return { day, counts, span: { from: span?.first_day, to: span?.last_day }, dayStartHour: config.dayStartHour }
}

/** A whole range aggregated: where the time went over a week, over a month. */
/** One weekday, one hour, or both — a cell of the heatmap, or a whole row of it. */
export type Slot = { weekday?: number | null; hour?: number | null }

/**
 * Narrows a query to a slot, reading the weekday and hour off a timestamp in
 * local time.
 *
 * The rule has to be the heatmap's own, to the letter: it files each block
 * under the hour it *started*, on the local clock. Anything else — the day
 * column, which turns over at four in the morning; the hour a block ended —
 * and a cell that reads "2h10" would open onto charts that add up to
 * something else.
 *
 * The column is ours, never the caller's, so it goes into the text; the
 * numbers go in as parameters.
 */
function inSlot(ts: string, slot: Slot): [string, number[]] {
  const parts: string[] = []
  const args: number[] = []
  if (slot.weekday != null) {
    parts.push(` and cast(strftime('%w', ${ts}, 'unixepoch', 'localtime') as integer) = ?`)
    args.push(slot.weekday)
  }
  if (slot.hour != null) {
    parts.push(` and cast(strftime('%H', ${ts}, 'unixepoch', 'localtime') as integer) = ?`)
    args.push(slot.hour)
  }
  return [parts.join(''), args]
}

export type WritingKind = 'ai' | 'chat' | 'mail' | 'search' | 'code' | 'web' | 'other'

/**
 * What kind of writing an app's text is, by the app alone. The text is never
 * read for this: a question to Claude is "ai" because it was typed into
 * Claude, not because of what it said.
 */
export function writingKind(app: string | null | undefined): WritingKind {
  const name = (app ?? '').toLowerCase()
  // Whole words: "arc" is a browser, "Archive Utility" is not.
  const has = (...words: string[]) => new RegExp(`\\b(${words.join('|')})\\b`).test(name)
  if (has('claude', 'chatgpt', 'codex', 'gemini', 'perplexity', 'copilot')) return 'ai'
  if (has('whatsapp', 'slack', 'telegram', 'messages', 'discord', 'teams', 'signal')) return 'chat'
  if (has('mail', 'outlook', 'spark', 'mimestream')) return 'mail'
  if (has('spotlight', 'raycast', 'alfred')) return 'search'
  if (has('code', 'cursor', 'zed', 'xcode', 'terminal', 'iterm2?', 'ghostty', 'warp', 'intellij idea', 'webstorm', 'pycharm', 'sublime text', 'windsurf')) return 'code'
  if (has('google chrome', 'chrome', 'safari', 'arc', 'firefox', 'brave browser', 'microsoft edge', 'orion')) return 'web'
  return 'other'
}

export function periodSummary(from: string, to: string, slot: Slot = {}) {
  const [blockSlot, blockArgs] = inSlot('started_at', slot)
  const [tsSlot, tsArgs] = inSlot('ts', slot)
  // Agent work is counted by the minute, as unix minutes rather than seconds.
  const [minuteSlot, minuteArgs] = inSlot('minute * 60', slot)

  const blocks = all<any>(
    `select app, title, host, seconds from blocks
      where day between ? and ? and idle = 0${blockSlot}`, from, to, ...blockArgs)

  const apps = new Map<string, number>()
  const categories = new Map<string, number>()
  const projects = new Map<string, number>()
  let total = 0
  let focusSeconds = 0

  for (const block of blocks) {
    const label = labelOf(block)
    total += block.seconds
    apps.set(block.app, (apps.get(block.app) ?? 0) + block.seconds)
    const category = label?.category ?? 'unlabelled'
    categories.set(category, (categories.get(category) ?? 0) + block.seconds)
    if (label?.project) projects.set(label.project, (projects.get(label.project) ?? 0) + block.seconds)
    if (isFocus(label?.category)) focusSeconds += block.seconds
  }

  const slices = (map: Map<string, number>, limit: number) =>
    [...map].map(([name, seconds]) => ({ name, seconds })).sort((a, b) => b.seconds - a.seconds).slice(0, limit)

  return {
    total,
    focusSeconds,
    focusRatio: total ? focusSeconds / total : 0,
    apps: slices(apps, 12),
    categories: slices(categories, 10),
    projects: slices(projects, 10),
    shortcuts: all<any>(
      `select detail as name, count(*) as n from events where kind = 'shortcut' and day between ? and ?
        and detail <> ''${tsSlot} group by detail order by n desc limit 12`, from, to, ...tsArgs),
    hosts: all<any>(
      `select host as name, count(*) as n from visits where day between ? and ? and host <> ''${tsSlot}
        group by host order by n desc limit 12`, from, to, ...tsArgs),
    typing: one<any>(
      `select coalesce(sum(chars),0) chars, count(*) samples from typing
        where day between ? and ?${tsSlot}`, from, to, ...tsArgs),
    // The hands, per app: keys, clicks and scroll are counted in every block,
    // and no text is kept for it. "Most of the keys went to Claude" needs
    // nothing more than this.
    hands: all<any>(
      `select app as name, sum(keys) keys, sum(clicks) clicks, sum(scroll) scroll from blocks
        where day between ? and ? and idle = 0${blockSlot}
        group by app having sum(keys) + sum(clicks) + sum(scroll) > 0 order by sum(keys) desc limit 8`,
      from, to, ...blockArgs),
    written: writtenByKind(from, to, tsSlot, tsArgs),
    commits: one<any>(
      `select count(*) n from commits where day between ? and ?${tsSlot}`, from, to, ...tsArgs)?.n ?? 0,
    aiTurns: one<any>(
      `select count(*) n from ai_turns where day between ? and ?${tsSlot}`, from, to, ...tsArgs)?.n ?? 0,
    // Agent work by name: this machine uses both Claude Code and Codex, and
    // adding them under one label ("Claude Code requests") tells a lie.
    agents: all<any>(
      `select agent as name, count(*) as minutes from agent_minutes
        where day between ? and ?${minuteSlot} group by agent order by minutes desc`,
      from, to, ...minuteArgs),
  }
}

/** Characters written, by kind, where the text was kept. */
function writtenByKind(from: string, to: string, tsSlot: string, tsArgs: number[]) {
  const kinds = new Map<WritingKind, number>()
  for (const row of all<{ app: string | null; chars: number }>(
    `select app, sum(chars) chars from typing where day between ? and ?${tsSlot} group by app`, from, to, ...tsArgs)) {
    const kind = writingKind(row.app)
    kinds.set(kind, (kinds.get(kind) ?? 0) + row.chars)
  }
  return [...kinds].map(([kind, chars]) => ({ kind, chars })).filter((row) => row.chars > 0).sort((a, b) => b.chars - a.chars)
}

export type Session = { start: number; end: number; minutes: number }

/**
 * A focus session: the stretch where concentrated work held together.
 *
 * The day becomes minutes; a minute counts as focus when the block covering it falls
 * numa categoria de trabalho concentrado. Uma janela deslizante de 15 minutes
 * needs 75% of those minutes to count, and a break shorter than 2 minutes does
 * not end the session. The thresholds are a convention — what matters is that
 * they stay frozen, because the number is only for comparing you with you.
 */
export function focusSessions(day: string): Session[] {
  const blocks = all<any>(
    `select started_at, ended_at, app, title, host from blocks
      where day = ? and idle = 0 order by started_at`, day)
  if (!blocks.length) return []

  const first = Math.floor(blocks[0].started_at / 60)
  const last = Math.ceil(blocks[blocks.length - 1].ended_at / 60)
  const total = last - first
  if (total <= 0) return []

  const focus = new Uint8Array(total)
  for (const block of blocks) {
    if (!isFocus(labelOf(block)?.category)) continue
    const de = Math.max(0, Math.floor(block.started_at / 60) - first)
    const to = Math.min(total, Math.ceil(block.ended_at / 60) - first)
    for (let m = de; m < to; m++) focus[m] = 1
  }

  const WINDOW = 15
  const REQUIRED = 0.75
  const dense = new Uint8Array(total)
  let sum = 0
  for (let m = 0; m < total; m++) {
    sum += focus[m]
    if (m >= WINDOW) sum -= focus[m - WINDOW]
    if (m >= WINDOW - 1 && sum / WINDOW >= REQUIRED) {
      for (let j = m - WINDOW + 1; j <= m; j++) dense[j] = 1
    }
  }

  const sessions: Session[] = []
  let start = -1
  for (let m = 0; m <= total; m++) {
    const inside = m < total && dense[m] === 1
    if (inside && start < 0) start = m
    if (!inside && start >= 0) {
      const previous = sessions[sessions.length - 1]
      const realStart = (first + start) * 60
      const realEnd = (first + m) * 60
      // A break too short does not separate two sessions: it is breathing, not stopping.
      if (previous && realStart - previous.end < 120) {
        previous.end = realEnd
        previous.minutes = Math.round((previous.end - previous.start) / 60)
      } else {
        sessions.push({ start: realStart, end: realEnd, minutes: m - start })
      }
      start = -1
    }
  }
  return sessions
}

const BANDS: [string, number, number][] = [
  ['<15', 0, 15], ['15–25', 15, 25], ['25–50', 25, 50],
  ['50–90', 50, 90], ['90+', 90, Infinity],
]

/** The shape of the day's focus: how many minutes came from sessions of each length. */
export function focusShape(sessions: Session[]) {
  const bands = BANDS.map(([name, de, to]) => {
    const inside = sessions.filter((s) => s.minutes >= de && s.minutes < to)
    return { name: name, minutes: inside.reduce((sum, s) => sum + s.minutes, 0), n: inside.length }
  })
  const durations = sessions.map((s) => s.minutes).sort((a, b) => a - b)
  return {
    bands,
    total: durations.reduce((sum, m) => sum + m, 0),
    longest: durations[durations.length - 1] ?? 0,
    // Median, not mean: the tail of long sessions would drag the mean upwards.
    median: durations.length ? durations[Math.floor(durations.length / 2)] : 0,
    sessions: durations.length,
  }
}

/**
 * What happened on this same date, before.
 *
 * This is the feature that keeps people in a journal more than any other —
 * coming back and recognising your own past. Here it is free: the data is
 * already in the database, it only had to be asked for.
 */
export function onThisDay(day: string) {
  const [year, month, dayOfMonth] = day.split('-').map(Number)
  // The label is a code, not a sentence: the screen speaks five languages and
  // a stored phrase would be stuck in the one the app was installed in.
  const marks = [
    { label: 'a-week-ago', at: new Date(year, month - 1, dayOfMonth - 7) },
    { label: 'a-month-ago', at: new Date(year, month - 2, dayOfMonth) },
    { label: 'three-months-ago', at: new Date(year, month - 4, dayOfMonth) },
    { label: 'a-year-ago', at: new Date(year - 1, month - 1, dayOfMonth) },
  ]

  return marks.map(({ label, at }) => {
    const key = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`
    const stored = one<any>(
      `select day, active_seconds, top_app, narrative from days where day = ?`, key)
    const measured = one<any>(
      `select sum(case when idle = 0 then seconds else 0 end) active from blocks where day = ?`, key)
    const projects = all<any>(
      `select project, sum(minutes) minutes from episodes where day = ? and project is not null
        group by project order by minutes desc limit 3`, key)
    if (!measured?.ativo) return null
    return {
      label,
      day: key,
      active: measured.ativo as number,
      topApp: stored?.top_app ?? null,
      narrative: stored?.narrative ?? null,
      projects: projects.map((p) => p.project as string),
    }
  }).filter(Boolean) as {
    label: string; day: string; active: number
    topApp: string | null; narrative: string | null; projects: string[]
  }[]
}
