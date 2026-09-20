import { all, one } from './db.ts'
import { config, dayOf } from './config.ts'

export type AppSlice = { app: string; seconds: number; category: string | null }
export type Slice = { name: string; seconds: number }
export type TimelineBlock = {
  start: number; end: number; app: string; title: string | null
  category: string | null; idle: number; focus: number | null
  delegado: boolean
}

// A chave do rótulo normaliza dígitos, então a junção com o jev acontece em JS,
// pelo mesmo normalizador que gravou o rótulo.
import { labelKey, cachedLabel } from './jev.ts'

/**
 * Categorias onde trabalho concentrado acontece.
 *
 * O foco é definido aqui, em código, e não pela probabilidade `deep_work` do
 * jev. Medindo de verdade, aquela probabilidade fica espremida entre 0,34 e
 * 0,67 — até "código" tira 0,65 — porque o título de uma janela não basta para
 * julgar concentração, e o modelo responde com a incerteza que realmente tem.
 * Usar a média dela como "% de foco" seria apresentar média de probabilidade
 * como fração de tempo, que é coisa diferente. A categoria, essa o jev acerta
 * com confiança alta, e a regra abaixo é legível e discutível.
 */
const CATEGORIAS_DE_FOCO = new Set(['codigo', 'ia', 'escrita', 'design', 'pesquisa'])

export const ehFoco = (categoria: string | null | undefined) =>
  CATEGORIAS_DE_FOCO.has(categoria ?? '')

function labelOf(row: { app: string | null; title: string | null; host: string | null }) {
  return cachedLabel(labelKey(row))
}

/**
 * Os minutos em que um agente estava trabalhando naquele dia.
 *
 * Serve para separar duas coisas que o relógio confunde: tempo parado porque
 * você saiu, e tempo parado porque você delegou. Quem trabalha com agentes
 * produz muito fora do teclado, e chamar isso de ociosidade é medir errado.
 */
function agentMinutes(day: string): Set<number> {
  return new Set(
    all<any>('select minute from agent_minutes where day = ?', day).map((r) => r.minute as number))
}

/** Quantos segundos de um intervalo caem em minutos com agente ativo. */
function delegatedSeconds(start: number, end: number, ativos: Set<number>): number {
  let total = 0
  for (let minuto = Math.floor(start / 60); minuto <= Math.floor(end / 60); minuto++) {
    if (!ativos.has(minuto)) continue
    const de = Math.max(start, minuto * 60)
    const ate = Math.min(end, (minuto + 1) * 60)
    total += Math.max(0, ate - de)
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
  const agentes = agentMinutes(day)
  const delegated = idleBlocks.reduce(
    (sum, b) => sum + delegatedSeconds(b.started_at, b.ended_at, agentes), 0)

  const apps = new Map<string, number>()
  const categories = new Map<string, number>()
  const projects = new Map<string, number>()
  const windows = new Map<string, { app: string; seconds: number }>()
  let focusSeconds = 0

  for (const block of active) {
    const label = labelOf(block)
    apps.set(block.app, (apps.get(block.app) ?? 0) + block.seconds)
    const category = label?.category ?? 'sem rótulo'
    categories.set(category, (categories.get(category) ?? 0) + block.seconds)
    if (label?.project) projects.set(label.project, (projects.get(label.project) ?? 0) + block.seconds)
    if (ehFoco(label?.category)) focusSeconds += block.seconds
    if (block.title) {
      const key = `${block.app}|${block.title}`
      const seen = windows.get(key) ?? { app: block.app, seconds: 0 }
      seen.seconds += block.seconds
      windows.set(key, seen)
    }
  }

  // Trocas de app: quantas vezes o foco mudou de aplicativo ao longo do dia.
  // O primeiro bloco não é uma troca — começar a trabalhar não é trocar.
  // Além do total, separa a troca barata (mesmo projeto) da cara (muda o projeto),
  // que é a única que corresponde ao resíduo de atenção.
  let switches = 0
  let switchesProjeto = 0
  let previous: string | null = null
  let previousProject: string | null | undefined
  for (const block of active) {
    const project = labelOf(block)?.project ?? null
    if (previous !== null && block.app !== previous) {
      switches++
      if (previousProject !== undefined && project !== previousProject) switchesProjeto++
    }
    previous = block.app
    previousProject = project
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
      // Faixa ociosa com agente ativo se desenha diferente: não é buraco no dia.
      delegado: block.idle
        ? delegatedSeconds(block.started_at, block.ended_at, agentes) > (block.seconds * 0.4)
        : false,
    })
  }

  const sortSlices = (map: Map<string, number>): Slice[] =>
    [...map].map(([name, seconds]) => ({ name, seconds })).sort((a, b) => b.seconds - a.seconds)

  const bounds = one<any>(
    `select min(started_at) first_at, max(ended_at) last_at from blocks where day = ? and idle = 0`, day)
  const sessoes = focusSessions(day)

  return {
    day,
    sessoes,
    forma: focusShape(sessoes),
    activeSeconds,
    idleSeconds,
    delegatedSeconds: delegated,
    awaySeconds: Math.max(0, idleSeconds - delegated),
    agentMinutes: agentes.size,
    focusSeconds,
    focusRatio: activeSeconds ? focusSeconds / activeSeconds : 0,
    switches,
    switchesProjeto,
    firstAt: bounds?.first_at ?? null,
    lastAt: bounds?.last_at ?? null,
    apps: sortSlices(apps).slice(0, 14),
    categories: sortSlices(categories),
    projects: sortSlices(projects).slice(0, 10),
    windows: [...windows].map(([key, value]) => ({
      title: key.split('|').slice(1).join('|'), app: value.app, seconds: value.seconds,
    })).sort((a, b) => b.seconds - a.seconds).slice(0, 12),
    // Abaixo de 20s o trecho não chega a um pixel na fita; some do desenho,
    // mas a contagem fica visível para o dia não parecer mais limpo do que foi.
    timeline: timeline.filter((b) => b.end - b.start >= 20),
    timelineOcultos: timeline.filter((b) => b.end - b.start < 20).length,
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
    // Teclas, cliques e rolagem contados pelo sistema — sem permissão e sem
    // guardar o que foi digitado. É o que separa escrever de ler.
    entrada: one<any>(
      `select coalesce(sum(keys),0) teclas, coalesce(sum(clicks),0) cliques,
              coalesce(sum(scroll),0) rolagem from blocks where day = ?`, day),
    entradaPorApp: all<any>(
      `select app, sum(keys) teclas, sum(clicks) cliques, sum(scroll) rolagem
         from blocks where day = ? and idle = 0
        group by app having teclas + cliques + rolagem > 20
        order by teclas + cliques desc limit 8`, day),
    // Som tocando com microfone parado é mídia; com microfone ativo é chamada.
    // O microfone da escuta própria já foi descontado na coleta.
    trilha: one<any>(
      `select coalesce(sum(case when som = 1 and mic = 0 then seconds else 0 end), 0) segundos,
              coalesce(sum(case when mic = 1 then seconds else 0 end), 0) emChamada
         from blocks where day = ? and idle = 0`, day),
    midias: all<any>(
      `select midia as name, sum(seconds) seconds from blocks
        where day = ? and idle = 0 and midia is not null and som = 1
        group by midia order by seconds desc`, day),
    telas: all<any>(
      `select tela as name, sum(seconds) seconds from blocks
        where day = ? and idle = 0 and tela is not null
        group by tela order by seconds desc`, day),
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
  let focusSeconds = 0

  for (const block of blocks) {
    const label = labelOf(block)
    total += block.seconds
    apps.set(block.app, (apps.get(block.app) ?? 0) + block.seconds)
    const category = label?.category ?? 'sem rótulo'
    categories.set(category, (categories.get(category) ?? 0) + block.seconds)
    if (label?.project) projects.set(label.project, (projects.get(label.project) ?? 0) + block.seconds)
    if (ehFoco(label?.category)) focusSeconds += block.seconds
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
        and detail <> '' group by detail order by n desc limit 12`, from, to),
    hosts: all<any>(
      `select host as name, count(*) as n from visits where day between ? and ? and host <> ''
        group by host order by n desc limit 12`, from, to),
    typing: one<any>(
      `select coalesce(sum(chars),0) chars, count(*) samples from typing where day between ? and ?`, from, to),
    commits: one<any>(`select count(*) n from commits where day between ? and ?`, from, to)?.n ?? 0,
    aiTurns: one<any>(`select count(*) n from ai_turns where day between ? and ?`, from, to)?.n ?? 0,
    // Trabalho de agente por nome: a máquina usa Claude Code e Codex, e somar
    // os dois num rótulo só ("pedidos ao Claude Code") conta mentira.
    agentes: all<any>(
      `select agent as name, count(*) as minutos from agent_minutes
        where day between ? and ? group by agent order by minutos desc`, from, to),
  }
}

export type Sessao = { start: number; end: number; minutes: number }

/**
 * Sessão de foco: trecho em que o trabalho concentrado se sustentou.
 *
 * O dia vira minutos; um minuto conta como foco quando o bloco que o cobre cai
 * numa categoria de trabalho concentrado. Uma janela deslizante de 15 minutos
 * precisa de 75% desses minutos para valer, e uma quebra menor que 2 minutos não
 * encerra a sessão. Os limiares são convenção — o que importa é que fiquem
 * congelados, porque o número só serve para comparar você com você.
 */
export function focusSessions(day: string): Sessao[] {
  const blocks = all<any>(
    `select started_at, ended_at, app, title, host from blocks
      where day = ? and idle = 0 order by started_at`, day)
  if (!blocks.length) return []

  const primeiro = Math.floor(blocks[0].started_at / 60)
  const ultimo = Math.ceil(blocks[blocks.length - 1].ended_at / 60)
  const total = ultimo - primeiro
  if (total <= 0) return []

  const foco = new Uint8Array(total)
  for (const block of blocks) {
    if (!ehFoco(labelOf(block)?.category)) continue
    const de = Math.max(0, Math.floor(block.started_at / 60) - primeiro)
    const ate = Math.min(total, Math.ceil(block.ended_at / 60) - primeiro)
    for (let m = de; m < ate; m++) foco[m] = 1
  }

  const JANELA = 15
  const EXIGIDO = 0.75
  const densa = new Uint8Array(total)
  let soma = 0
  for (let m = 0; m < total; m++) {
    soma += foco[m]
    if (m >= JANELA) soma -= foco[m - JANELA]
    if (m >= JANELA - 1 && soma / JANELA >= EXIGIDO) {
      for (let j = m - JANELA + 1; j <= m; j++) densa[j] = 1
    }
  }

  const sessoes: Sessao[] = []
  let inicio = -1
  for (let m = 0; m <= total; m++) {
    const dentro = m < total && densa[m] === 1
    if (dentro && inicio < 0) inicio = m
    if (!dentro && inicio >= 0) {
      const anterior = sessoes[sessoes.length - 1]
      const comecoReal = (primeiro + inicio) * 60
      const fimReal = (primeiro + m) * 60
      // Quebra curta demais não separa duas sessões: é respirar, não parar.
      if (anterior && comecoReal - anterior.end < 120) {
        anterior.end = fimReal
        anterior.minutes = Math.round((anterior.end - anterior.start) / 60)
      } else {
        sessoes.push({ start: comecoReal, end: fimReal, minutes: m - inicio })
      }
      inicio = -1
    }
  }
  return sessoes
}

const FAIXAS: [string, number, number][] = [
  ['<15', 0, 15], ['15–25', 15, 25], ['25–50', 25, 50],
  ['50–90', 50, 90], ['90+', 90, Infinity],
]

/** A forma do foco do dia: quantos minutos vieram de sessões de cada tamanho. */
export function focusShape(sessoes: Sessao[]) {
  const faixas = FAIXAS.map(([nome, de, ate]) => {
    const dentro = sessoes.filter((s) => s.minutes >= de && s.minutes < ate)
    return { name: nome, minutes: dentro.reduce((soma, s) => soma + s.minutes, 0), n: dentro.length }
  })
  const duracoes = sessoes.map((s) => s.minutes).sort((a, b) => a - b)
  return {
    faixas,
    total: duracoes.reduce((soma, m) => soma + m, 0),
    maior: duracoes[duracoes.length - 1] ?? 0,
    // Mediana, não média: a cauda de sessões longas puxaria a média para cima.
    mediana: duracoes.length ? duracoes[Math.floor(duracoes.length / 2)] : 0,
    sessoes: duracoes.length,
  }
}

/**
 * O que aconteceu nesta mesma data, antes.
 *
 * É o recurso que mais segura gente em diário — voltar e reconhecer o próprio
 * passado. Aqui ele é de graça: o dado já está no banco, só faltava perguntar.
 */
export function onThisDay(day: string) {
  const [ano, mes, dia] = day.split('-').map(Number)
  const marcos = [
    { rotulo: 'há uma semana', data: new Date(ano, mes - 1, dia - 7) },
    { rotulo: 'há um mês', data: new Date(ano, mes - 2, dia) },
    { rotulo: 'há três meses', data: new Date(ano, mes - 4, dia) },
    { rotulo: 'há um ano', data: new Date(ano - 1, mes - 1, dia) },
  ]

  return marcos.map(({ rotulo, data }) => {
    const chave = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`
    const salvo = one<any>(
      `select day, active_seconds, top_app, narrative from days where day = ?`, chave)
    const medido = one<any>(
      `select sum(case when idle = 0 then seconds else 0 end) ativo from blocks where day = ?`, chave)
    const projetos = all<any>(
      `select project, sum(minutes) minutos from episodes where day = ? and project is not null
        group by project order by minutos desc limit 3`, chave)
    if (!medido?.ativo) return null
    return {
      rotulo,
      day: chave,
      active: medido.ativo as number,
      topApp: salvo?.top_app ?? null,
      narrative: salvo?.narrative ?? null,
      projetos: projetos.map((p) => p.project as string),
    }
  }).filter(Boolean) as {
    rotulo: string; day: string; active: number
    topApp: string | null; narrative: string | null; projetos: string[]
  }[]
}
