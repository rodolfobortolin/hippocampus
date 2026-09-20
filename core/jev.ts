import { config } from './config.ts'
import { db, one } from './db.ts'

// O jev responde perguntas tipadas com probabilidade calibrada em ~100ms.
// Cada janela vira uma classificação guardada, então a mesma janela nunca
// custa duas chamadas.
const ENDPOINT = 'https://api.typesafe.ai/v1/systemone'

/**
 * As categorias julgam o ASSUNTO, nunca o meio.
 *
 * A primeira versão dizia que distração era "vídeo, rede social, notícia" — e
 * com isso um vídeo sobre a própria ferramenta que a pessoa estava avaliando
 * naquele dia entrava como distração, com 0,99 de confiança. A confiança era
 * alta justamente porque a instrução não deixava dúvida; ela é que estava
 * errada. YouTube não é uma categoria: depende do vídeo.
 */
export const CATEGORIES: Record<string, string> = {
  codigo: 'Escrever, ler ou revisar código; terminal; git; banco de dados',
  ia: 'Conversar com um assistente de IA para produzir trabalho',
  pesquisa:
    'Investigar ou aprender algo que serve ao trabalho: documentação, busca, ' +
    'artigo, fórum, e também vídeo ou tutorial sobre assunto técnico, ' +
    'ferramenta, produto concorrente ou tema do projeto. O meio não decide — ' +
    'um vídeo sobre uma tecnologia é pesquisa, não entretenimento.',
  comunicacao: 'E-mail, chat, mensagens, reunião, chamada',
  escrita: 'Escrever texto, documento, proposta, nota',
  design: 'Interface, protótipo, editar imagem ou vídeo do próprio trabalho',
  admin: 'Arquivos, ajustes, instalação, organização, burocracia, banco, contas',
  distracao:
    'Lazer: o assunto não tem relação com o trabalho da pessoa — humor, fofoca, ' +
    'esporte, jogo, compras, rede social, notícia geral. Um vídeo só entra aqui ' +
    'quando o ASSUNTO é entretenimento.',
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
      // Sem saber no que a pessoa trabalha, não há como julgar se o assunto de
      // um vídeo ou de um artigo serve ao trabalho dela ou é passatempo.
      pessoa_trabalha_com: projects.slice(0, 12),
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
  const confianca = data.answers?.categoria?.confidence ?? 0
  // Erro confiante custa mais que lacuna assumida: quem vê um número errado
  // para de confiar no resto. Abaixo de 0,55 a janela fica sem rótulo.
  const label: Label = {
    key,
    category: confianca >= 0.55 ? data.answers?.categoria?.choice ?? 'sem rótulo' : 'sem rótulo',
    project: !project || project === 'nenhum' ? null : project,
    deep_work: data.answers?.foco?.noul ?? 0.5,
    confidence: confianca,
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

/**
 * Qual modelo do Claude Code deve responder.
 *
 * Gastar o modelo mais forte para responder "que horas eu comecei hoje" é
 * desperdício de tempo e de cota. O jev julga a complexidade do pedido em
 * ~110ms, com uma pergunta tipada, e o roteamento acontece aqui no código —
 * quem decide o mapa é você, não o modelo.
 */
const ESCADA = [
  'claude-haiku-4-5-20251001',  // consulta direta
  'claude-sonnet-5',            // cruzar fontes e resumir
  'claude-opus-5',              // análise longa, escrita, recap
] as const

const NIVEIS = [
  'Pergunta direta: a resposta é um número, uma data ou um fato que sai de uma consulta só',
  'Precisa cruzar algumas fontes, comparar períodos ou resumir em poucas linhas',
  'Análise de verdade, comparação ao longo do tempo, texto longo, recap com graça, ou raciocínio sobre causa',
]

export type Roteamento = { modelo: string; nivel: number; confianca: number }

export async function escolheModelo(pedido: string): Promise<Roteamento | null> {
  if (!jevReady()) return null

  try {
    const resposta = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { authorization: `Bearer ${config.typesafeKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: config.typesafeModel,
        state: { pedido: pedido.slice(0, 1200) },
        questions: {
          complexidade: {
            type: 'score',
            instructions: 'Quanto esforço de raciocínio este pedido exige para ser respondido bem',
            criteria: NIVEIS,
          },
        },
      }),
      signal: AbortSignal.timeout(8000),
    })
    if (!resposta.ok) return null

    const dados = (await resposta.json()) as any
    const nivel = Math.round(dados.answers?.complexidade?.score ?? 1)
    const confianca = dados.answers?.complexidade?.confidence ?? 0
    // Na dúvida, sobe um degrau: errar para mais forte custa tempo; errar para
    // mais fraco custa uma resposta ruim, que é pior.
    const ajustado = confianca < 0.5 ? Math.min(2, nivel + 1) : nivel
    return { modelo: ESCADA[Math.max(0, Math.min(2, ajustado))], nivel: ajustado, confianca }
  } catch {
    return null
  }
}
