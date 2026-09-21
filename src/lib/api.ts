/**
 * Which core to talk to. The installed one, normally; another one when the
 * page is opened with `?core=7979` — that is how the demo database is shown for
 * screenshots, without touching the real core or the real data.
 */
const PORT = (() => {
  const asked = Number(new URLSearchParams(globalThis.location?.search ?? '').get('core'))
  if (Number.isInteger(asked) && asked > 1024 && asked < 65536) return asked
  return (globalThis as any).HIPPOCAMPUS_PORT ?? 7878
})()

const BASE = `http://127.0.0.1:${PORT}`

export type Slice = { name: string; seconds: number }
export type RibbonBlock = {
  start: number; end: number; app: string; title: string | null
  category: string | null; idle: number; focus: number | null
  delegated: boolean
}

export type Day = {
  day: string
  activeSeconds: number
  idleSeconds: number
  delegatedSeconds: number
  awaySeconds: number
  agentMinutes: number
  focusRatio: number
  focusSeconds: number
  switches: number
  switchesProject: number
  timelineHidden: number
  sessions: { start: number; end: number; minutes: number }[]
  focusShape: {
    bands: { name: string; minutes: number; n: number }[]
    total: number; longest: number; median: number; sessions: number
  }
  firstAt: number | null
  lastAt: number | null
  /** Time at the machine, from macOS's record of input. */
  presence: { seconds: number; stretches: number }
  meetings: Meeting[]
  apps: Slice[]
  categories: Slice[]
  projects: Slice[]
  windows: { title: string; app: string; seconds: number }[]
  timeline: RibbonBlock[]
  shortcuts: { name: string; n: number }[]
  clicks: number
  typing: { chars: number; samples: number }
  commits: { repo: string; subject: string; ts: number; insertions: number; deletions: number }[]
  hosts: { name: string; n: number }[]
  visits: number
  input: { keys: number; clicks: number; scroll: number }
  inputPerApp: { app: string; keys: number; clicks: number; scroll: number }[]
  screens: Slice[]
  /** inCall: the microphone open; onCamera: the part of it with a camera on too. */
  soundtrack: { seconds: number; inCall: number; onCamera: number }
  media: Slice[]
  aiTurns: { project: string; prompt: string; tools: string; ts: number }[]
  stored: { narrative: string; recap: string; built_at: number } | null
}

export type Status = {
  collector: {
    /** `null` until the helper has reported; not the same as denied. */
    running: boolean; trusted: boolean | null; skysight: boolean
    lastSample: { app?: string; title?: string; idle: number; locked: boolean } | null
    startedAt: number; lastRollup: string
    sources: Record<string, string>
  }
  jev: boolean; claude: boolean; vault: boolean; voice: boolean; user: string; language: string
  day: string
  counts: Record<string, number>
  span: { from: string; to: string }
}

/** The notes that outlive a day, and where they are kept. */
export type NoteKind = 'project' | 'knowledge' | 'person' | 'area' | 'inbox'
export type NotesView = {
  kind: NoteKind
  folders: { kind: NoteKind; folder: string; exists: boolean }[]
  titles: string[]
  vault: boolean
}
export type Captured = { file: string; created: boolean; section: string | null; error?: string }

export type Settings = {
  language: 'pt-BR' | 'en-US' | 'es-ES' | 'fr-FR' | 'de-DE'
  name: string
  vault: string
  journalFolder: string
  dayStartHour: number
  keepTyping: boolean
  voice: string
  /** The keyboard shortcut that calls the core. Empty means none. */
  shortcut: string
  /** `push` records and takes turns; `live` opens a real-time session. */
  voiceMode: 'push' | 'live'
  liveVoice: string
  /** Which OpenAI geography the key belongs to. */
  region: 'global' | 'eu'
  /** Whether the floating core writes what it heard and what it answered. */
  caption: boolean
  /** Whether the conversation may reach beyond this app's own database. */
  wideTools: boolean
  calendar: boolean
  timesheet: boolean
  /** The folder the repositories live in. */
  codeRoot: string
  /** Whether the first-run walkthrough was finished or skipped. */
  onboarded: boolean
  /** '' until the helper has asked; then 'granted' or 'denied'. */
  calendarStatus: string
  liveVoices: string[]
  /** False when there is no OpenAI key, which is what the live voice needs. */
  liveAvailable: boolean
  languages: Record<string, { name: string; flag: string; intl: string }>
  /** Only the state of the keys comes back through the API — never the value. */
  keys: { jev: 'keychain' | 'environment' | 'empty'; openai: 'keychain' | 'environment' | 'empty' }
}

/** One weekday (0 is Sunday), one hour, or both. */
export type Slot = { weekday?: number | null; hour?: number | null }

export type Period = {
  from: string; to: string
  /** What the summary was narrowed to; the map and the days never are. */
  slot: Slot
  days: { day: string; active: number; idle: number; focusRatio: number | null; hasNarrative: boolean }[]
  rhythm: number[][]
  /** The whole period — what the figures at the top describe. */
  summary: PeriodSummary
  /** The same, narrowed to the picked slot; null when nothing is picked. */
  narrowed: PeriodSummary | null
}

export type PeriodSummary = {
  total: number; focusRatio: number; focusSeconds: number
  apps: Slice[]; categories: Slice[]; projects: Slice[]
  shortcuts: { name: string; n: number }[]
  hosts: { name: string; n: number }[]
  typing: { chars: number; samples: number }
  hands: { name: string; keys: number; clicks: number; scroll: number }[]
  written: { kind: WritingKind; chars: number }[]
  commits: number; aiTurns: number
  agents: { name: string; minutes: number }[]
}

export type WritingKind = 'ai' | 'chat' | 'mail' | 'search' | 'code' | 'web' | 'other'

// The pieces of work are shaped in the core; the screen only reads them.
export type { Meeting } from '../../core/sources/calendar.ts'
export type { Timesheet, TimesheetClient, TimesheetLine } from '../../core/timesheet.ts'
import type { Timesheet } from '../../core/timesheet.ts'
import type { Meeting } from '../../core/sources/calendar.ts'
export type { Item, Org, Touch, WorkItems } from '../../core/items.ts'
export type { PageKind } from '../../core/pages.ts'
import type { Item, Touch, WorkItems } from '../../core/items.ts'

export type StoredDay = {
  day: string; active_seconds: number; focus_ratio: number
  top_app: string; narrative: string; recap: string; built_at: number
}

async function get<T>(route: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${route}`, options)
  if (!response.ok) throw new Error(`${response.status} em ${route}`)
  return response.json() as Promise<T>
}

export const api = {
  status: () => get<Status>('/api/status'),
  day: (day: string) => get<Day>(`/api/day/${day}`),
  period: (from: string, to: string, slot: Slot = {}) => {
    const narrow = [
      slot.weekday != null ? `&weekday=${slot.weekday}` : '',
      slot.hour != null ? `&hour=${slot.hour}` : '',
    ].join('')
    return get<Period>(`/api/period?from=${from}&to=${to}${narrow}`)
  },
  days: () => get<StoredDay[]>('/api/days'),
  items: (from: string, to: string) => get<WorkItems>(`/api/items?from=${from}&to=${to}`),
  timesheet: (from: string, to: string) => get<Timesheet>(`/api/timesheet?from=${from}&to=${to}`),
  repos: (root?: string) =>
    get<{ root: string; repos: number; names: string[]; readable: boolean }>(`/api/repos${root ? `?root=${encodeURIComponent(root)}` : ''}`),
  askAccessibility: () => get<{ asked: boolean }>('/api/permission/accessibility', { method: 'POST' }),
  blocked: () => get<{ browsers: string[] }>('/api/blocked'),
  retryBlocked: () => get<{ ok: boolean }>('/api/blocked', { method: 'POST' }),
  item: (key: string, from: string, to: string) =>
    get<{ item: Item | null; touches: Touch[] }>(`/api/item?key=${encodeURIComponent(key)}&from=${from}&to=${to}`),
  close: (day: string, narrate = true) =>
    get<{ narrative: string; recap: string; classified: number }>(
      `/api/rollup?day=${day}&narrate=${narrate ? 1 : 0}`, { method: 'POST' }),
  notes: (kind: NoteKind) => get<NotesView>(`/api/notes?kind=${kind}`),
  capture: (body: { kind: NoteKind; title: string; text: string; section?: string }) =>
    get<Captured>('/api/capture', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    }),
  settings: () => get<Settings>('/api/settings'),
  saveSettings: (change: Record<string, unknown>) => get<Settings>('/api/settings', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(change),
  }),
  socket: () => new WebSocket(`ws://127.0.0.1:${PORT}/ws`),
  transcribe: async (audio: Blob): Promise<string> => {
    const response = await fetch(`${BASE}/api/transcribe`, {
      method: 'POST', headers: { 'content-type': 'audio/webm' }, body: audio,
    })
    if (!response.ok) throw new Error((await response.json()).error ?? 'falha ao transcribe')
    return (await response.json()).text as string
  },
  voice: (text: string) => fetch(`${BASE}/api/speak`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text }),
  }),
}
