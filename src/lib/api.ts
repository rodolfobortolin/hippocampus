const BASE = `http://127.0.0.1:${(globalThis as any).HIPOCAMPO_PORT ?? 7878}`

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
  soundtrack: { seconds: number; inCall: number }
  media: Slice[]
  aiTurns: { project: string; prompt: string; tools: string; ts: number }[]
  stored: { narrative: string; recap: string; built_at: number } | null
}

export type Status = {
  collector: {
    running: boolean; trusted: boolean; skysight: boolean
    lastSample: { app?: string; title?: string; idle: number; locked: boolean } | null
    startedAt: number; lastRollup: string
    sources: Record<string, string>
  }
  jev: boolean; claude: boolean; vault: boolean; voice: boolean; user: string; language: string
  day: string
  counts: Record<string, number>
  span: { from: string; to: string }
}

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
  liveVoices: string[]
  /** False when there is no OpenAI key, which is what the live voice needs. */
  liveAvailable: boolean
  languages: Record<string, { name: string; flag: string; intl: string }>
  /** Only the state of the keys comes back through the API — never the value. */
  keys: { jev: 'keychain' | 'environment' | 'empty'; openai: 'keychain' | 'environment' | 'empty' }
}

export type Period = {
  from: string; to: string
  days: { day: string; active: number; idle: number; focusRatio: number | null; hasNarrative: boolean }[]
  rhythm: number[][]
  summary: {
    total: number; focusRatio: number; focusSeconds: number
    apps: Slice[]; categories: Slice[]; projects: Slice[]
    shortcuts: { name: string; n: number }[]
    hosts: { name: string; n: number }[]
    typing: { chars: number; samples: number }
    commits: number; aiTurns: number
    agents: { name: string; minutes: number }[]
  }
}

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
  period: (from: string, to: string) => get<Period>(`/api/period?from=${from}&to=${to}`),
  days: () => get<StoredDay[]>('/api/days'),
  close: (day: string, narrate = true) =>
    get<{ narrative: string; recap: string; classified: number }>(
      `/api/rollup?day=${day}&narrate=${narrate ? 1 : 0}`, { method: 'POST' }),
  settings: () => get<Settings>('/api/settings'),
  saveSettings: (change: Record<string, unknown>) => get<Settings>('/api/settings', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(change),
  }),
  socket: () => new WebSocket(`ws://127.0.0.1:${(globalThis as any).HIPOCAMPO_PORT ?? 7878}/ws`),
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
