const BASE = `http://127.0.0.1:${(globalThis as any).HIPOCAMPO_PORT ?? 7878}`

export type Fatia = { name: string; seconds: number }
export type BlocoFita = {
  start: number; end: number; app: string; title: string | null
  category: string | null; idle: number; focus: number | null
  delegado: boolean
}

export type Dia = {
  day: string
  activeSeconds: number
  idleSeconds: number
  delegatedSeconds: number
  awaySeconds: number
  agentMinutes: number
  focusRatio: number
  focusSeconds: number
  switches: number
  switchesProjeto: number
  timelineOcultos: number
  sessoes: { start: number; end: number; minutes: number }[]
  forma: {
    faixas: { name: string; minutes: number; n: number }[]
    total: number; maior: number; mediana: number; sessoes: number
  }
  firstAt: number | null
  lastAt: number | null
  apps: Fatia[]
  categories: Fatia[]
  projects: Fatia[]
  windows: { title: string; app: string; seconds: number }[]
  timeline: BlocoFita[]
  shortcuts: { name: string; n: number }[]
  clicks: number
  typing: { chars: number; samples: number }
  commits: { repo: string; subject: string; ts: number; insertions: number; deletions: number }[]
  hosts: { name: string; n: number }[]
  visits: number
  entrada: { teclas: number; cliques: number; rolagem: number }
  entradaPorApp: { app: string; teclas: number; cliques: number; rolagem: number }[]
  telas: Fatia[]
  aiTurns: { project: string; prompt: string; tools: string; ts: number }[]
  stored: { narrative: string; recap: string; built_at: number } | null
}

export type Status = {
  coletor: {
    running: boolean; trusted: boolean; skysight: boolean
    lastSample: { app?: string; title?: string; idle: number; locked: boolean } | null
    startedAt: number; lastRollup: string
    fontes: Record<string, string>
  }
  jev: boolean; claude: boolean; vault: boolean; voz: boolean; usuario: string
  day: string
  counts: Record<string, number>
  span: { de: string; ate: string }
}

export type Periodo = {
  de: string; ate: string
  dias: { day: string; active: number; idle: number; focusRatio: number | null; hasNarrative: boolean }[]
  ritmo: number[][]
  resumo: {
    total: number; focusRatio: number; focusSeconds: number
    apps: Fatia[]; categories: Fatia[]; projects: Fatia[]
    shortcuts: { name: string; n: number }[]
    hosts: { name: string; n: number }[]
    typing: { chars: number; samples: number }
    commits: number; aiTurns: number
    agentes: { name: string; minutos: number }[]
  }
}

export type DiaSalvo = {
  day: string; active_seconds: number; focus_ratio: number
  top_app: string; narrative: string; recap: string; built_at: number
}

async function pega<T>(rota: string, opcoes?: RequestInit): Promise<T> {
  const resposta = await fetch(`${BASE}${rota}`, opcoes)
  if (!resposta.ok) throw new Error(`${resposta.status} em ${rota}`)
  return resposta.json() as Promise<T>
}

export const api = {
  status: () => pega<Status>('/api/status'),
  dia: (dia: string) => pega<Dia>(`/api/dia/${dia}`),
  periodo: (de: string, ate: string) => pega<Periodo>(`/api/periodo?de=${de}&ate=${ate}`),
  dias: () => pega<DiaSalvo[]>('/api/dias'),
  fechar: (dia: string, narrar = true) =>
    pega<{ narrative: string; recap: string; classified: number }>(
      `/api/rollup?dia=${dia}&narrar=${narrar ? 1 : 0}`, { method: 'POST' }),
  socket: () => new WebSocket(`ws://127.0.0.1:${(globalThis as any).HIPOCAMPO_PORT ?? 7878}/ws`),
  transcrever: async (audio: Blob): Promise<string> => {
    const resposta = await fetch(`${BASE}/api/transcrever`, {
      method: 'POST', headers: { 'content-type': 'audio/webm' }, body: audio,
    })
    if (!resposta.ok) throw new Error((await resposta.json()).erro ?? 'falha ao transcrever')
    return (await resposta.json()).texto as string
  },
  voz: (texto: string) => fetch(`${BASE}/api/voz`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ texto }),
  }),
}
