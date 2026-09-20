import { query, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import { config, today, dayOf } from './config.ts'
import { all } from './db.ts'
import { dayReport, rangeReport, heatmap } from './metrics.ts'
import { dossier } from './rollup.ts'

const hours = (seconds: number) => `${Math.floor(seconds / 3600)}h${String(Math.round((seconds % 3600) / 60)).padStart(2, '0')}`
const say = (value: unknown) => ({
  content: [{ type: 'text' as const, text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }],
})

const range = { de: z.string().describe('AAAA-MM-DD'), ate: z.string().describe('AAAA-MM-DD') }

// As ferramentas rodam dentro deste processo: o modelo consulta o banco local
// sem que nenhum dado precise ir junto no prompt.
const tools = [
  {
    name: 'dia',
    description: 'Tudo que foi medido num dia: tempo por app, categoria, projeto, janelas, commits, sites, pedidos ao Claude Code e amostras de escrita.',
    inputSchema: { data: z.string().describe('AAAA-MM-DD; use "hoje" para o dia corrente') },
    handler: async ({ data }: { data: string }) => say(dossier(data === 'hoje' ? today() : data)),
  },
  {
    name: 'periodo',
    description: 'Tempo ativo e foco por dia num intervalo. Use para tendência, semana, mês e comparação entre dias.',
    inputSchema: range,
    handler: async ({ de, ate }: { de: string; ate: string }) => {
      const rows = rangeReport(de, ate)
      if (!rows.length) return say('Sem dados medidos nesse intervalo.')
      return say(rows.map((r) =>
        `${r.day}: ativo ${hours(r.active)}, ocioso ${hours(r.idle)}` +
        (r.focusRatio != null ? `, foco ${Math.round(r.focusRatio * 100)}%` : '')).join('\n'))
    },
  },
  {
    name: 'ritmo',
    description: 'Mapa hora × dia da semana com os segundos ativos — mostra em que horários a pessoa trabalha.',
    inputSchema: range,
    handler: async ({ de, ate }: { de: string; ate: string }) => {
      const grid = heatmap(de, ate)
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
    description: 'Procura por título de janela ou nome de app e soma o tempo. Use para "quanto tempo gastei no X".',
    inputSchema: { termo: z.string(), de: z.string().optional(), ate: z.string().optional() },
    handler: async ({ termo, de, ate }: { termo: string; de?: string; ate?: string }) => {
      const rows = all<any>(
        `select app, title, sum(seconds) total, min(day) primeiro, max(day) ultimo, count(distinct day) dias
           from blocks
          where idle = 0 and (title like ? or app like ? or host like ?)
            and day between ? and ?
          group by app, title order by total desc limit 25`,
        `%${termo}%`, `%${termo}%`, `%${termo}%`, de ?? '0000-00-00', ate ?? '9999-99-99')
      if (!rows.length) return say(`Nada medido com "${termo}".`)
      const total = rows.reduce((sum, r) => sum + r.total, 0)
      return say(`Total ${hours(total)} em ${rows.length} janelas.\n` +
        rows.map((r) => `- ${r.app} · ${r.title ?? '—'}: ${hours(r.total)} (${r.dias} dias, ${r.primeiro}–${r.ultimo})`).join('\n'))
    },
  },
  {
    name: 'sites',
    description: 'Sites mais visitados no período, pelo histórico do navegador.',
    inputSchema: range,
    handler: async ({ de, ate }: { de: string; ate: string }) => say(
      all<any>(`select host, count(*) n from visits where day between ? and ? and host <> ''
                 group by host order by n desc limit 25`, de, ate)
        .map((r) => `${r.host}: ${r.n}`).join('\n') || 'Sem visitas guardadas.'),
  },
  {
    name: 'pedidos_ia',
    description: 'O que a pessoa pediu ao Claude Code no período, com as ferramentas que ele usou. Revela no que ela estava trabalhando de verdade.',
    inputSchema: { de: z.string(), ate: z.string(), termo: z.string().optional() },
    handler: async ({ de, ate, termo }: { de: string; ate: string; termo?: string }) => {
      const rows = all<any>(
        `select day, project, prompt, tools from ai_turns
          where day between ? and ? and (? = '' or prompt like ?)
          order by ts limit 80`, de, ate, termo ?? '', `%${termo ?? ''}%`)
      if (!rows.length) return say('Nenhum pedido nesse intervalo.')
      return say(rows.map((r) => `${r.day} [${r.project}] ${String(r.prompt).slice(0, 220)}`).join('\n'))
    },
  },
  {
    name: 'commits',
    description: 'Commits feitos no período, por repositório.',
    inputSchema: range,
    handler: async ({ de, ate }: { de: string; ate: string }) => say(
      all<any>(`select day, repo, subject, insertions, deletions from commits
                 where day between ? and ? order by ts`, de, ate)
        .map((r) => `${r.day} ${r.repo}: ${r.subject} (+${r.insertions}/-${r.deletions})`).join('\n')
        || 'Sem commits no intervalo.'),
  },
  {
    name: 'escrita',
    description: 'Amostras do que a pessoa digitou (já sem segredos) e o volume por app. Use para falar do estilo de escrita.',
    inputSchema: range,
    handler: async ({ de, ate }: { de: string; ate: string }) => {
      const volume = all<any>(
        `select app, sum(chars) chars, count(*) amostras from typing where day between ? and ?
          group by app order by chars desc limit 10`, de, ate)
      const samples = all<any>(
        `select app, text from typing where day between ? and ? and length(text) > 40
          order by length(text) desc limit 20`, de, ate)
      return say(
        'Volume:\n' + volume.map((v) => `- ${v.app}: ${v.chars} caracteres em ${v.amostras} campos`).join('\n') +
        '\n\nAmostras:\n' + samples.map((s) => `- [${s.app}] ${s.text}`).join('\n'))
    },
  },
  {
    name: 'atalhos',
    description: 'Atalhos de teclado mais usados no período.',
    inputSchema: range,
    handler: async ({ de, ate }: { de: string; ate: string }) => say(
      all<any>(`select detail, app, count(*) n from events where kind = 'shortcut' and day between ? and ?
                 and detail <> '' group by detail order by n desc limit 20`, de, ate)
        .map((r) => `${r.detail} × ${r.n} (mais em ${r.app})`).join('\n') || 'Sem atalhos guardados.'),
  },
]

const server = createSdkMcpServer({ name: 'hipocampo', version: '1.0.0', tools: tools as any })

function persona(): string {
  const now = new Date()
  return `Você é o Hipocampo: a memória do computador do ${config.userName}, com acesso ao que foi medido na máquina dele.
Hoje é ${today()} (${now.toLocaleDateString('pt-BR', { weekday: 'long' })}), agora são ${now.toTimeString().slice(0, 5)}.
O dia começa às ${config.dayStartHour}h — madrugada conta para o dia anterior.

Fale português do Brasil, direto, na segunda pessoa. Sem bajulação, sem "ótima pergunta".
Consulte as ferramentas antes de afirmar qualquer coisa sobre o dia dele: o valor aqui é o número real, não o palpite.
Se o dado não existir no período pedido, diga que não existe em vez de estimar.
Respostas curtas por padrão. Quando ele pedir recap, roast ou análise, aí sim se estenda e tenha graça.
Os dados nunca saem desta máquina; não sugira mandar nada para lugar nenhum.`
}

export type AgentEvent =
  | { type: 'texto'; texto: string }
  | { type: 'ferramenta'; nome: string }
  | { type: 'fim'; texto: string }
  | { type: 'erro'; erro: string }

/** Conversa com o Claude Code, com as ferramentas do banco local. */
export async function* chat(prompt: string, sessionId?: string): AsyncGenerator<AgentEvent> {
  const run = query({
    prompt,
    options: {
      cwd: config.dataDir,
      ...(config.claudeModel ? { model: config.claudeModel } : {}),
      ...(sessionId ? { resume: sessionId } : {}),
      permissionMode: 'bypassPermissions',
      systemPrompt: { type: 'preset', preset: 'claude_code', append: persona() },
      mcpServers: { hipocampo: server },
      allowedTools: tools.map((tool) => `mcp__hipocampo__${tool.name}`),
      disallowedTools: ['AskUserQuestion'],
    },
  })

  let final = ''
  try {
    for await (const message of run as any) {
      if (message.type === 'assistant') {
        for (const block of message.message?.content ?? []) {
          if (block.type === 'text' && block.text?.trim()) yield { type: 'texto', texto: block.text }
          if (block.type === 'tool_use') {
            yield { type: 'ferramenta', nome: String(block.name).replace('mcp__hipocampo__', '') }
          }
        }
      }
      if (message.type === 'result') {
        final = message.subtype === 'success' ? message.result ?? '' : ''
        if (message.subtype !== 'success') yield { type: 'erro', erro: 'O Claude Code não concluiu a resposta.' }
      }
    }
  } catch (error) {
    yield { type: 'erro', erro: (error as Error).message }
    return
  }
  yield { type: 'fim', texto: final }
}
