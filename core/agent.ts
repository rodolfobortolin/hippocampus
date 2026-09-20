import { query, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import { HOW_TO_WRITE, LANGUAGES, validLanguage } from './languages.ts'
import { PERSONAS } from './personas.ts'
import { config, today, dayOf } from './config.ts'
import { all } from './db.ts'
import { dayReport, rangeReport, heatmap, onThisDay } from './metrics.ts'
import { dossier } from './rollup.ts'
import { searchEpisodes, lastTime, type Episodio } from './episodes.ts'
import { pickModel } from './jev.ts'

const hours = (seconds: number) => `${Math.floor(seconds / 3600)}h${String(Math.round((seconds % 3600) / 60)).padStart(2, '0')}`
const say = (value: unknown) => ({
  content: [{ type: 'text' as const, text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }],
})

const range = { de: z.string().describe('AAAA-MM-DD'), to: z.string().describe('AAAA-MM-DD') }

// As ferramentas rodam inside deste processo: o modelo lookup o banco local
// sem que nenhum dado precise ir junto no prompt.
const when = (ts: number) =>
  new Date(ts * 1000).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

function describe(episodio: Episodio, detalhado = false): string {
  const list = (raw: string) => JSON.parse(raw) as string[]
  const lines = [
    `${when(episodio.started_at)} · ${episodio.minutes}min · ` +
    `${episodio.project ?? 'project indefinido'} · ${episodio.category ?? '—'}`,
    `  apps: ${list(episodio.apps).join(', ')}`,
  ]
  const titles = list(episodio.titles)
  if (titles.length) lines.push(`  janelas: ${titles.slice(0, detalhado ? 20 : 5).join(' | ')}`)
  if (detalhado) {
    const sites = list(episodio.hosts)
    const commits = list(episodio.commits)
    const prompts = list(episodio.prompts)
    const shell = list(episodio.shell)
    if (sites.length) lines.push(`  sites: ${sites.join(', ')}`)
    if (commits.length) lines.push(`  commits: ${commits.join(' · ')}`)
    if (prompts.length) lines.push(`  pediu ao Claude Code: ${prompts.join(' · ')}`)
    if (shell.length) lines.push(`  comandos: ${shell.join(' · ')}`)
  }
  return lines.join('\n')
}

const tools = [
  {
    name: 'procurar',
    description: 'Procura MOMENTOS por text em tudo que foi measured — título de janela, site, project, commit, comando e o que foi request ao Claude Code. Use sempre que a pergunta for sobre "when eu…", "onde eu vi…", "aquele day que…".',
    inputSchema: { termo: z.string().describe('palavras livres, em linguagem natural'), limite: z.number().optional() },
    handler: async ({ termo, limite }: { termo: string; limite?: number }) => {
      const found = searchEpisodes(termo, Math.min(limite ?? 10, 25))
      if (!found.length) return say(`Nada measured casa com "${termo}".`)
      return say(`${found.length} momentos:\n\n` + found.map((e) => describe(e)).join('\n\n'))
    },
  },
  {
    name: 'ultima_vez',
    description: 'A última vez que a pessoa mexeu em algo (um project, file, site, assunto), com o que estava acontecendo em volta. Use para retomar contexto: "onde eu parei no X", "o que eu estava fazendo when mexi nisso".',
    inputSchema: { termo: z.string() },
    handler: async ({ termo }: { termo: string }) => {
      const found = lastTime(termo)
      if (!found) return say(`Nunca foi measured nada sobre "${termo}".`)
      const before = found.neighbours.filter((v) => v.started_at < found.target.started_at).slice(-2)
      const after = found.neighbours.filter((v) => v.started_at > found.target.started_at).slice(0, 2)
      return say([
        `Última vez em "${termo}": ${found.day}`,
        '',
        describe(found.target, true),
        before.length ? '\nAntes disso:\n' + before.map((e) => describe(e)).join('\n') : '',
        after.length ? '\nDepois:\n' + after.map((e) => describe(e)).join('\n') : '',
      ].filter(Boolean).join('\n'))
    },
  },
  {
    name: 'neste_dia',
    description: 'O que aconteceu nesta mesma data em semanas, meses e anos anteriores. Use when ele perguntar sobre o passado, quiser comparar com before, ou pedir uma retrospectiva.',
    inputSchema: { data: z.string().describe('AAAA-MM-DD; use "hoje" para o day corrente') },
    handler: async ({ data }: { data: string }) => {
      const before = onThisDay(data === 'hoje' ? today() : data)
      if (!before.length) return say('Ainda não há nenhuma data previous medida para comparar.')
      return say(before.map((entry) =>
        `${entry.label} (${entry.day}): ${hours(entry.active)} ativo` +
        (entry.topApp ? `, mais em ${entry.topApp}` : '') +
        (entry.projects.length ? `, projects: ${entry.projects.join(', ')}` : '') +
        (entry.narrative ? `\n  ${entry.narrative.replace(/\s+/g, ' ').slice(0, 300)}` : '')
      ).join('\n\n'))
    },
  },
  {
    name: 'day',
    description: 'O que foi measured num day. Por padrão vem o resumo — tempo ativo, focus, sessões, trocas, tempo por app, categoria e project —, que responde quase tudo. Peça detalhe só when precisar de janelas, commits, sites, pedidos a agents e amostras de escrita.',
    inputSchema: {
      data: z.string().describe('AAAA-MM-DD; use "hoje" para o day corrente'),
      detalhe: z.boolean().optional().describe('true traz o day inteiro; custa mais e raramente é preciso'),
    },
    handler: async ({ data, detalhe }: { data: string; detalhe?: boolean }) =>
      say(dossier(data === 'hoje' ? today() : data, detalhe ? 'completo' : 'resumo')),
  },
  {
    name: 'periodo',
    description: 'Tempo ativo e focus por day num intervalo. Use para tendência, semana, mês e comparação entre days.',
    inputSchema: range,
    handler: async ({ de, to }: { de: string; to: string }) => {
      const rows = rangeReport(de, to)
      if (!rows.length) return say('Sem data medidos nesse intervalo.')
      return say(rows.map((r) =>
        `${r.day}: ativo ${hours(r.active)}, ocioso ${hours(r.idle)}` +
        (r.focusRatio != null ? `, focus ${Math.round(r.focusRatio * 100)}%` : '')).join('\n'))
    },
  },
  {
    name: 'ritmo',
    description: 'Mapa hora × day da semana com os segundos ativos — mostra em que horários a pessoa trabalha.',
    inputSchema: range,
    handler: async ({ de, to }: { de: string; to: string }) => {
      const grid = heatmap(de, to)
      const names = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
      return say(grid.map((row, day) => {
        const busy = row.map((seconds, hour) => ({ hour, seconds })).filter((h) => h.seconds > 120)
        if (!busy.length) return `${names[day]}: —`
        return `${names[day]}: ` + busy.map((h) => `${h.hour}h ${Math.round(h.seconds / 60)}min`).join(', ')
      }).join('\n'))
    },
  },
  {
    name: 'buscar_janelas',
    description: 'Procura por título de janela ou name de app e sum o tempo. Use para "quanto tempo gastei no X".',
    inputSchema: { termo: z.string(), de: z.string().optional(), to: z.string().optional() },
    handler: async ({ termo, de, to }: { termo: string; de?: string; to?: string }) => {
      const rows = all<any>(
        `select app, title, sum(seconds) total, min(day) first, max(day) last, count(distinct day) days
           from blocks
          where idle = 0 and (title like ? or app like ? or host like ?)
            and day between ? and ?
          group by app, title order by total desc limit 25`,
        `%${termo}%`, `%${termo}%`, `%${termo}%`, de ?? '0000-00-00', to ?? '9999-99-99')
      if (!rows.length) return say(`Nada measured com "${termo}".`)
      const total = rows.reduce((sum, r) => sum + r.total, 0)
      return say(`Total ${hours(total)} em ${rows.length} janelas.\n` +
        rows.map((r) => `- ${r.app} · ${r.title ?? '—'}: ${hours(r.total)} (${r.days} days, ${r.first}–${r.last})`).join('\n'))
    },
  },
  {
    name: 'sites',
    description: 'Sites mais visitados no período, pelo histórico do navegador.',
    inputSchema: range,
    handler: async ({ de, to }: { de: string; to: string }) => say(
      all<any>(`select host, count(*) n from visits where day between ? and ? and host <> ''
                 group by host order by n desc limit 25`, de, to)
        .map((r) => `${r.host}: ${r.n}`).join('\n') || 'Sem visitas guardadas.'),
  },
  {
    name: 'pedidos_ia',
    description: 'O que a pessoa pediu ao Claude Code no período, com as ferramentas que ele usou. Revela no que ela estava trabalhando de verdade.',
    inputSchema: { de: z.string(), to: z.string(), termo: z.string().optional() },
    handler: async ({ de, to, termo }: { de: string; to: string; termo?: string }) => {
      const rows = all<any>(
        `select day, project, prompt, tools from ai_turns
          where day between ? and ? and (? = '' or prompt like ?)
          order by ts limit 80`, de, to, termo ?? '', `%${termo ?? ''}%`)
      if (!rows.length) return say('Nenhum request nesse intervalo.')
      return say(rows.map((r) => `${r.day} [${r.project}] ${String(r.prompt).slice(0, 220)}`).join('\n'))
    },
  },
  {
    name: 'commits',
    description: 'Commits feitos no período, por repositório.',
    inputSchema: range,
    handler: async ({ de, to }: { de: string; to: string }) => say(
      all<any>(`select day, repo, subject, insertions, deletions from commits
                 where day between ? and ? order by ts`, de, to)
        .map((r) => `${r.day} ${r.repo}: ${r.subject} (+${r.insertions}/-${r.deletions})`).join('\n')
        || 'Sem commits no intervalo.'),
  },
  {
    name: 'escrita',
    description: 'Amostras do que a pessoa digitou (já sem segredos) e o volume por app. Use para falar do estilo de escrita.',
    inputSchema: range,
    handler: async ({ de, to }: { de: string; to: string }) => {
      const volume = all<any>(
        `select app, sum(chars) chars, count(*) amostras from typing where day between ? and ?
          group by app order by chars desc limit 10`, de, to)
      const samples = all<any>(
        `select app, text from typing where day between ? and ? and length(text) > 40
          order by length(text) desc limit 20`, de, to)
      return say(
        'Volume:\n' + volume.map((v) => `- ${v.app}: ${v.chars} caracteres em ${v.amostras} campos`).join('\n') +
        '\n\nAmostras:\n' + samples.map((s) => `- [${s.app}] ${s.text}`).join('\n'))
    },
  },
  {
    name: 'atalhos',
    description: 'Atalhos de teclado mais usados no período.',
    inputSchema: range,
    handler: async ({ de, to }: { de: string; to: string }) => say(
      all<any>(`select detail, app, count(*) n from events where kind = 'shortcut' and day between ? and ?
                 and detail <> '' group by detail order by n desc limit 20`, de, to)
        .map((r) => `${r.detail} × ${r.n} (mais em ${r.app})`).join('\n') || 'Sem atalhos guardados.'),
  },
]

const server = createSdkMcpServer({
  name: 'hipocampo',
  version: '1.0.0',
  tools: tools as any,
  // Sem isto o SDK adia as ferramentas e o modelo gasta uma ida e volta
  // inteira só para descobrir que elas existem — measured em 4,1s before de
  // chegar na primeira lookup de verdade. São dez ferramentas pequenas;
  // cabem no prompt sem drama.
  alwaysLoad: true,
})

function persona(): string {
  const language = validLanguage(config.lang)
  const who = PERSONAS[language]
  const now = new Date()
  const intl = LANGUAGES[language].intl
  return [
    HOW_TO_WRITE[language],
    '',
    who.conversa(
      config.userName,
      today(),
      now.toLocaleDateString(intl, { weekday: 'long' }),
      now.toTimeString().slice(0, 5),
      config.dayStartHour,
    ),
    '',
    who.tom,
  ].join('\n')
}

export type AgentEvent =
  | { type: 'modelo'; modelo: string; level: number }
  | { type: 'delta'; text: string }
  | { type: 'text'; text: string }
  | { type: 'ferramenta'; name: string }
  | { type: 'end'; text: string }
  | { type: 'erro'; erro: string }

/** Conversa com o Claude Code, com as ferramentas do banco local. */
export async function* chat(prompt: string, sessionId?: string): AsyncGenerator<AgentEvent> {
  // Um modelo à altura do request: o jev julga a complexidade before de começar.
  // Com HIPOCAMPO_MODEL definido, a escolha é sua e o roteamento sai do path.
  const route = config.claudeModel ? null : await pickModel(prompt)
  if (route) yield { type: 'modelo', modelo: route.modelo, level: route.level }

  const run = query({
    prompt,
    options: {
      cwd: config.dataDir,
      ...(config.claudeModel ? { model: config.claudeModel } : route ? { model: route.modelo } : {}),
      ...(sessionId ? { resume: sessionId } : {}),
      permissionMode: 'bypassPermissions',
      // Sem isto a response só aparece when o block inteiro termina. Medido
      // numa pergunta trivial: a primeira letra existe aos 3s e o block close
      // aos 6,4s — metade da espera era só esperar.
      includePartialMessages: true,
      systemPrompt: { type: 'preset', preset: 'claude_code', append: persona() },
      mcpServers: { hipocampo: server },
      allowedTools: tools.map((tool) => `mcp__hipocampo__${tool.name}`),
      disallowedTools: ['AskUserQuestion'],
    },
  })

  let final = ''
  try {
    for await (const message of run as any) {
      // O text chega em pedaços; o block completo que vem after repetiria
      // tudo, então dele só interessa o uso de ferramenta.
      if (message.type === 'stream_event') {
        const delta = message.event?.delta
        if (delta?.type === 'text_delta' && delta.text) {
          yield { type: 'delta', text: delta.text }
        }
        continue
      }

      if (message.type === 'assistant') {
        for (const block of message.message?.content ?? []) {
          if (block.type === 'tool_use') {
            const name = String(block.name)
            // Ferramenta interna do SDK (busca de esquema) não é lookup ao
            // banco; o painel mostra "pensando" em vez de um name sem sentido.
            yield { type: 'ferramenta', name: name.startsWith('mcp__hipocampo__')
              ? name.replace('mcp__hipocampo__', '') : '' }
          }
        }
      }
      if (message.type === 'result') {
        final = message.subtype === 'success' ? message.result ?? '' : ''
        if (message.subtype !== 'success') yield { type: 'erro', erro: 'O Claude Code não concluiu a response.' }
      }
    }
  } catch (error) {
    yield { type: 'erro', erro: (error as Error).message }
    return
  }
  yield { type: 'end', text: final }
}
