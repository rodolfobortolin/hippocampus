import { config } from './config.ts'
import { db, one } from './db.ts'
import { CATEGORIES_BY_LANGUAGE, LEVELS_BY_LANGUAGE, JEV_QUESTIONS, validLanguage } from './languages.ts'

// jev answers typed questions with a calibrated probability in about 100ms.
// Each window becomes a stored classification, so the same window never costs
// two calls.
const ENDPOINT = 'https://api.typesafe.ai/v1/systemone'

/**
 * The categories judge the SUBJECT, never the medium.
 *
 * The first version said a distraction was "video, social network, news" — and
 * with that, a video about the very tool the person was evaluating that day
 * came back as a distraction, at 0.99 confidence. The confidence was high
 * precisely because the instruction left no doubt; the instruction was what
 * was wrong. YouTube is not a category: it depends on the video.
 */
export function categories(): Record<string, string> {
  return CATEGORIES_BY_LANGUAGE[validLanguage(config.lang)]
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

/** Classifies a window. Returns from cache when known, and null with no key. */
export async function classify(
  block: { app: string | null; title: string | null; host: string | null; url: string | null },
  projects: string[],
): Promise<Label | null> {
  const key = labelKey(block)
  const cached = cachedLabel(key)
  if (cached) return cached
  if (!jevReady()) return null

  const question = JEV_QUESTIONS[validLanguage(config.lang)]
  const projectOptions: Record<string, string> = { nenhum: question.noProject }
  for (const project of projects.slice(0, 24)) projectOptions[project] = `${project}`

  const body = {
    model: config.typesafeModel,
    state: {
      aplicativo: block.app,
      janela: block.title,
      site: block.host,
      endereco: block.url?.slice(0, 200) ?? null,
      // Without knowing what the person works on, there is no way to judge
      // whether a video's or an article's subject serves that work or is a pastime.
      pessoa_trabalha_com: projects.slice(0, 12),
    },
    questions: {
      categoria: { type: 'choice', instructions: question.category, criteria: categories() },
      project: { type: 'choice', instructions: question.project, criteria: projectOptions },
      focus: { type: 'noul', instructions: question.focus },
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
  const project = data.answers?.project?.choice
  const confidence = data.answers?.categoria?.confidence ?? 0
  // A confident mistake costs more than an admitted gap: someone who sees one
  // wrong number stops trusting the rest. Below 0.55 the window stays unlabelled.
  const label: Label = {
    key,
    category: confidence >= 0.55 ? data.answers?.categoria?.choice ?? 'unlabelled' : 'unlabelled',
    project: !project || project === 'nenhum' ? null : project,
    deep_work: data.answers?.focus?.noul ?? 0.5,
    confidence: confidence,
  }
  save.run(key, block.app, block.title?.slice(0, 200) ?? null, label.category, label.project,
    label.deep_work, label.confidence, data.model ?? config.typesafeModel, Math.floor(Date.now() / 1000))
  return label
}

/** Classifies a day's still-unlabelled windows, in controlled parallel. */
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
 * Spending the strongest model to answer "what time did I start today" wastes
 * both time and quota. jev judges the request's complexity in about 110ms,
 * with a typed question, and the routing happens here in the code — the map is
 * yours to decide, not the model's.
 */
const LADDER = [
  'claude-haiku-4-5-20251001',  // lookup direta
  'claude-sonnet-5',            // cruzar fontes e resumir
  'claude-opus-5',              // long analysis, prose, the recap
] as const


export type Routing = { model: string; level: number; confidence: number }

export async function pickModel(request: string): Promise<Routing | null> {
  if (!jevReady()) return null

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { authorization: `Bearer ${config.typesafeKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: config.typesafeModel,
        state: { request: request.slice(0, 1200) },
        questions: {
          complexidade: {
            type: 'score',
            instructions: JEV_QUESTIONS[validLanguage(config.lang)].complexity,
            criteria: LEVELS_BY_LANGUAGE[validLanguage(config.lang)],
          },
        },
      }),
      // A short ceiling: this sits on the answer's critical path, and choosing
      // the model cannot cost more than the choice saves.
      signal: AbortSignal.timeout(2500),
    })
    if (!response.ok) return null

    const data = (await response.json()) as any
    const level = Math.round(data.answers?.complexity?.score ?? 1)
    const confidence = data.answers?.complexity?.confidence ?? 0
    // When in doubt, go one step up: erring stronger costs time; erring
    // weaker costs a bad answer, which is worse.
    const adjusted = confidence < 0.5 ? Math.min(2, level + 1) : level
    return { model: LADDER[Math.max(0, Math.min(2, adjusted))], level: adjusted, confidence }
  } catch {
    return null
  }
}
