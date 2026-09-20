import { config } from './config.ts'
import { db, one } from './db.ts'

// O jev responde perguntas tipadas com probabilidade calibrada em ~100ms.
// Cada janela vira uma classificação guardada, então a mesma janela nunca
// custa duas chamadas.
const ENDPOINT = 'https://api.typesafe.ai/v1/systemone'

export const CATEGORIES: Record<string, string> = {
  codigo: 'Escrever, ler ou revisar código; terminal; git',
  ia: 'Conversar com um assistente de IA para produzir trabalho',
  pesquisa: 'Documentação, busca, leitura técnica, aprender algo',
  comunicacao: 'E-mail, chat, mensagens, reunião, chamada',
  escrita: 'Escrever texto, documento, proposta, nota',
  design: 'Interface, protótipo, imagem, vídeo',
  admin: 'Arquivos, ajustes, instalação, organização, burocracia',
  distracao: 'Vídeo, rede social, notícia, compras, jogo, lazer',
}

export type Label = {
  key: string
  category: string
  project: string | null
  deep_work: number
  confidence: number
}

function normalize(app: string, title: string | null, host: string | null): string {
  const base = (title ?? host ?? '').toLowerCase()
    .replace(/\d+/g, '#')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 90)
  return `${app}|${base}`
}

export function labelKey(block: { app: string | null; title: string | null; host: string | null }): string {
  return normalize(block.app ?? '?', block.title, block.host)
}

export function cachedLabel(key: string): Label | undefined {
  return one<Label>('select key, category, project, deep_work, confidence from labels where key = ?', key)
}

export function jevReady(): boolean {
  return Boolean(config.typesafeKey)
}

const save = db.prepare(
  `insert into labels (key, app, sample_title, category, project, deep_work, confidence, model, created_at)
   values (?, ?, ?, ?, ?, ?, ?, ?, ?)
   on conflict(key) do update set category = excluded.category, project = excluded.project,
     deep_work = excluded.deep_work, confidence = excluded.confidence, model = excluded.model`,
)

/** Classifica uma janela. Devolve do cache quando já conhece, e null sem chave. */
export async function classify(
  block: { app: string | null; title: string | null; host: string | null; url: string | null },
  projects: string[],
): Promise<Label | null> {
  const key = labelKey(block)
  const cached = cachedLabel(key)
  if (cached) return cached
  if (!jevReady()) return null

  const projectOptions: Record<string, string> = { nenhum: 'Não dá para dizer a qual projeto pertence' }
  for (const project of projects.slice(0, 24)) projectOptions[project] = `Trabalho no projeto ${project}`

  const body = {
    model: config.typesafeModel,
    state: {
      aplicativo: block.app,
      janela: block.title,
      site: block.host,
      endereco: block.url?.slice(0, 200) ?? null,
    },
    questions: {
      categoria: { type: 'choice', instructions: 'Que tipo de atividade é esta', criteria: CATEGORIES },
      projeto: {
        type: 'choice',
        instructions: 'A qual projeto esta janela pertence, se der para saber pelo título',
        criteria: projectOptions,
      },
      foco: {
        type: 'noul',
        instructions: 'Esta é uma atividade de trabalho concentrado, e não uma distração ou pausa',
      },
    },
  }

  let response: Response
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { authorization: `Bearer ${config.typesafeKey}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    })
  } catch (error) {
    console.error('[jev] rede:', (error as Error).message)
    return null
  }
  if (!response.ok) {
    console.error('[jev]', response.status, (await response.text()).slice(0, 200))
    return null
  }

  const data = (await response.json()) as any
  const project = data.answers?.projeto?.choice
  const label: Label = {
    key,
    category: data.answers?.categoria?.choice ?? 'admin',
    project: !project || project === 'nenhum' ? null : project,
    deep_work: data.answers?.foco?.noul ?? 0.5,
    confidence: data.answers?.categoria?.confidence ?? 0,
  }
  save.run(key, block.app, block.title?.slice(0, 200) ?? null, label.category, label.project,
    label.deep_work, label.confidence, data.model ?? config.typesafeModel, Math.floor(Date.now() / 1000))
  return label
}

/** Classifica as janelas ainda sem rótulo de um dia, em paralelo controlado. */
export async function classifyDay(day: string, projects: string[]): Promise<number> {
  if (!jevReady()) return 0
  const blocks = db.prepare(
    `select app, title, host, url, sum(seconds) total from blocks
      where day = ? and idle = 0 group by app, title having total >= 20 order by total desc limit 120`,
  ).all(day) as any[]

  const pending = blocks.filter((block) => !cachedLabel(labelKey(block)))
  let done = 0
  const queue = [...pending]
  const workers = Array.from({ length: 6 }, async () => {
    while (queue.length) {
      const block = queue.shift()
      if (!block) break
      if (await classify(block, projects)) done++
    }
  })
  await Promise.all(workers)
  return done
}
