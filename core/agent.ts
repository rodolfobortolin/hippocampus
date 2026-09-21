import { query, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import { HOW_TO_WRITE, LANGUAGES, validLanguage, type Language } from './languages.ts'
import { PERSONAS } from './personas.ts'
import { config, today, dayOf } from './config.ts'
import { all } from './db.ts'
import { dayReport, rangeReport, heatmap, onThisDay } from './metrics.ts'
import { dossier } from './rollup.ts'
import { searchEpisodes, lastTime, type Episode } from './episodes.ts'
import { pickModel } from './jev.ts'
import { readSettings } from './settings.ts'

const hours = (seconds: number) => `${Math.floor(seconds / 3600)}h${String(Math.round((seconds % 3600) / 60)).padStart(2, '0')}`
const say = (value: unknown) => ({
  content: [{ type: 'text' as const, text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }],
})

const range = { from: z.string().describe('YYYY-MM-DD'), to: z.string().describe('YYYY-MM-DD') }

// The tools run inside this process: the model reads the local database
// without a single row having to travel in the prompt.
const when = (ts: number) =>
  new Date(ts * 1000).toLocaleString(LANGUAGES[validLanguage(config.lang)].intl,
    { dateStyle: 'short', timeStyle: 'short' })

function describe(episode: Episode, detailed = false): string {
  const list = (raw: string) => JSON.parse(raw) as string[]
  const lines = [
    `${when(episode.started_at)} · ${episode.minutes}min · ` +
    `${episode.project ?? 'no project'} · ${episode.category ?? '—'}`,
    `  apps: ${list(episode.apps).join(', ')}`,
  ]
  const titles = list(episode.titles)
  if (titles.length) lines.push(`  windows: ${titles.slice(0, detailed ? 20 : 5).join(' | ')}`)
  if (detailed) {
    const sites = list(episode.hosts)
    const commits = list(episode.commits)
    const prompts = list(episode.prompts)
    const shell = list(episode.shell)
    if (sites.length) lines.push(`  sites: ${sites.join(', ')}`)
    if (commits.length) lines.push(`  commits: ${commits.join(' · ')}`)
    if (prompts.length) lines.push(`  asked Claude Code: ${prompts.join(' · ')}`)
    if (shell.length) lines.push(`  commands: ${shell.join(' · ')}`)
  }
  return lines.join('\n')
}

const tools = [
  {
    name: 'search',
    description: 'Searches MOMENTS by text across everything measured — window title, site, project, commit, command and what was asked of Claude Code. Use it whenever the question is about "when did I…", "where did I see…", "that day when…".',
    inputSchema: { term: z.string().describe('free words, in natural language'), limit: z.number().optional() },
    handler: async ({ term, limit }: { term: string; limit?: number }) => {
      const found = searchEpisodes(term, Math.min(limit ?? 10, 25))
      if (!found.length) return say(`Nothing measured matches "${term}".`)
      return say(`${found.length} moments:\n\n` + found.map((e) => describe(e)).join('\n\n'))
    },
  },
  {
    name: 'last_time',
    description: 'The last time the person touched something (a project, a file, a site, a subject), with what was happening around it. Use it to pick context back up: "where did I leave off on X", "what was I doing when I touched this".',
    inputSchema: { term: z.string() },
    handler: async ({ term }: { term: string }) => {
      const found = lastTime(term)
      if (!found) return say(`Nothing about "${term}" was ever measured.`)
      const before = found.neighbours.filter((v) => v.started_at < found.target.started_at).slice(-2)
      const after = found.neighbours.filter((v) => v.started_at > found.target.started_at).slice(0, 2)
      return say([
        `Last time on "${term}": ${found.day}`,
        '',
        describe(found.target, true),
        before.length ? '\nBefore that:\n' + before.map((e) => describe(e)).join('\n') : '',
        after.length ? '\nAfter:\n' + after.map((e) => describe(e)).join('\n') : '',
      ].filter(Boolean).join('\n'))
    },
  },
  {
    name: 'on_this_day',
    description: 'What happened on this same date in earlier weeks, months and years. Use it when the person asks about the past, wants to compare against before, or asks for a retrospective.',
    inputSchema: { date: z.string().describe('YYYY-MM-DD; use "today" for the current day') },
    handler: async ({ date }: { date: string }) => {
      const before = onThisDay(date === 'today' ? today() : date)
      if (!before.length) return say('There is no earlier measured date to compare against yet.')
      return say(before.map((entry) =>
        `${entry.label} (${entry.day}): ${hours(entry.active)} active` +
        (entry.topApp ? `, mostly in ${entry.topApp}` : '') +
        (entry.projects.length ? `, projects: ${entry.projects.join(', ')}` : '') +
        (entry.narrative ? `\n  ${entry.narrative.replace(/\s+/g, ' ').slice(0, 300)}` : '')
      ).join('\n\n'))
    },
  },
  {
    name: 'day',
    description: 'What was measured on a day. By default it returns the summary — active time, focus, sessions, switches, time per app, per category and per project — which answers almost everything. Ask for detail only when you need windows, commits, sites, agent requests and writing samples.',
    inputSchema: {
      date: z.string().describe('YYYY-MM-DD; use "today" for the current day'),
      detail: z.boolean().optional().describe('true returns the whole day; it costs more and is rarely needed'),
    },
    handler: async ({ date, detail }: { date: string; detail?: boolean }) =>
      say(dossier(date === 'today' ? today() : date, detail ? 'completo' : 'resumo')),
  },
  {
    name: 'period',
    description: 'Active time and focus per day over a range. Use it for trends, a week, a month, and comparisons between days.',
    inputSchema: range,
    handler: async ({ from, to }: { from: string; to: string }) => {
      const rows = rangeReport(from, to)
      if (!rows.length) return say('Nothing was measured in that range.')
      return say(rows.map((r) =>
        `${r.day}: active ${hours(r.active)}, idle ${hours(r.idle)}` +
        (r.focusRatio != null ? `, focus ${Math.round(r.focusRatio * 100)}%` : '')).join('\n'))
    },
  },
  {
    name: 'rhythm',
    description: 'An hour × weekday map of active seconds — shows what times of day the person works.',
    inputSchema: range,
    handler: async ({ from, to }: { from: string; to: string }) => {
      const grid = heatmap(from, to)
      const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      return say(grid.map((row, day) => {
        const busy = row.map((seconds, hour) => ({ hour, seconds })).filter((h) => h.seconds > 120)
        if (!busy.length) return `${names[day]}: —`
        return `${names[day]}: ` + busy.map((h) => `${h.hour}h ${Math.round(h.seconds / 60)}min`).join(', ')
      }).join('\n'))
    },
  },
  {
    name: 'search_windows',
    description: 'Searches by window title or app name and adds up the time. Use it for "how long did I spend on X".',
    inputSchema: { term: z.string(), from: z.string().optional(), to: z.string().optional() },
    handler: async ({ term, from, to }: { term: string; from?: string; to?: string }) => {
      const rows = all<any>(
        `select app, title, sum(seconds) total, min(day) first, max(day) last, count(distinct day) days
           from blocks
          where idle = 0 and (title like ? or app like ? or host like ?)
            and day between ? and ?
          group by app, title order by total desc limit 25`,
        `%${term}%`, `%${term}%`, `%${term}%`, from ?? '0000-00-00', to ?? '9999-99-99')
      if (!rows.length) return say(`Nothing measured matches "${term}".`)
      const total = rows.reduce((sum, r) => sum + r.total, 0)
      return say(`Total ${hours(total)} across ${rows.length} windows.\n` +
        rows.map((r) => `- ${r.app} · ${r.title ?? '—'}: ${hours(r.total)} (${r.days} days, ${r.first}–${r.last})`).join('\n'))
    },
  },
  {
    name: 'sites',
    description: 'Most visited sites in the period, from the browser history.',
    inputSchema: range,
    handler: async ({ from, to }: { from: string; to: string }) => say(
      all<any>(`select host, count(*) n from visits where day between ? and ? and host <> ''
                 group by host order by n desc limit 25`, from, to)
        .map((r) => `${r.host}: ${r.n}`).join('\n') || 'No visits stored.'),
  },
  {
    name: 'ai_requests',
    description: 'What the person asked Claude Code during the period, with the tools it used. It reveals what they were actually working on.',
    inputSchema: { from: z.string(), to: z.string(), term: z.string().optional() },
    handler: async ({ from, to, term }: { from: string; to: string; term?: string }) => {
      const rows = all<any>(
        `select day, project, prompt, tools from ai_turns
          where day between ? and ? and (? = '' or prompt like ?)
          order by ts limit 80`, from, to, term ?? '', `%${term ?? ''}%`)
      if (!rows.length) return say('No requests in that range.')
      return say(rows.map((r) => `${r.day} [${r.project}] ${String(r.prompt).slice(0, 220)}`).join('\n'))
    },
  },
  {
    name: 'commits',
    description: 'Commits made in the period, by repository.',
    inputSchema: range,
    handler: async ({ from, to }: { from: string; to: string }) => say(
      all<any>(`select day, repo, subject, insertions, deletions from commits
                 where day between ? and ? order by ts`, from, to)
        .map((r) => `${r.day} ${r.repo}: ${r.subject} (+${r.insertions}/-${r.deletions})`).join('\n')
        || 'No commits in the range.'),
  },
  {
    name: 'writing',
    description: 'Samples of what the person typed (already stripped of secrets) and the volume per app. Use it to talk about writing style.',
    inputSchema: range,
    handler: async ({ from, to }: { from: string; to: string }) => {
      const volume = all<any>(
        `select app, sum(chars) chars, count(*) samples from typing where day between ? and ?
          group by app order by chars desc limit 10`, from, to)
      const samples = all<any>(
        `select app, text from typing where day between ? and ? and length(text) > 40
          order by length(text) desc limit 20`, from, to)
      return say(
        'Volume:\n' + volume.map((v) => `- ${v.app}: ${v.chars} characters across ${v.samples} fields`).join('\n') +
        '\n\nSamples:\n' + samples.map((s) => `- [${s.app}] ${s.text}`).join('\n'))
    },
  },
  {
    name: 'shortcuts',
    description: 'Most used keyboard shortcuts in the period.',
    inputSchema: range,
    handler: async ({ from, to }: { from: string; to: string }) => say(
      all<any>(`select detail, app, count(*) n from events where kind = 'shortcut' and day between ? and ?
                 and detail <> '' group by detail order by n desc limit 20`, from, to)
        .map((r) => `${r.detail} × ${r.n} (mostly in ${r.app})`).join('\n') || 'No shortcuts stored.'),
  },
]

const server = createSdkMcpServer({
  name: 'hippocampus',
  version: '1.0.0',
  tools: tools as any,
  // Without this the SDK defers the tools and the model spends a whole round
  // trip just to find out they exist — measured at 4.1s before it reached the
  // first real lookup. They are ten small tools; they fit in the prompt.
  alwaysLoad: true,
})

/**
 * What the model is told it can reach, beyond this app's own database.
 *
 * Without this it does not know: the tools are there, but the persona says it
 * is the memory of one machine, and a model told that does not go looking for
 * a browser or an inbox.
 */
const WIDE: Record<Language, string> = {
  'pt-BR': `Você também tem o resto do Claude Code nesta máquina: ler arquivos, rodar comandos, buscar na web, e os servidores MCP que ele já configurou. Use quando a pergunta pedir algo que não está no banco — o tempo lá fora, um arquivo, um e-mail, o que está numa página. Continue consultando o banco para tudo que é sobre o dia dele. Diga o que fez quando sair da máquina.`,
  'en-US': `You also have the rest of Claude Code on this machine: reading files, running commands, searching the web, and the MCP servers already configured here. Use them when the question asks for something the database does not hold — the weather outside, a file, an email, what is on a page. Keep using the database for anything about their day. Say what you did when you leave the machine.`,
  'es-ES': `También tienes el resto de Claude Code en esta máquina: leer archivos, ejecutar comandos, buscar en la web y los servidores MCP ya configurados. Úsalos cuando la pregunta pida algo que la base no tiene — el tiempo fuera, un archivo, un correo, lo que hay en una página. Sigue usando la base para todo lo que sea sobre su día. Di lo que hiciste cuando salgas de la máquina.`,
  'fr-FR': `Tu as aussi le reste de Claude Code sur cette machine : lire des fichiers, lancer des commandes, chercher sur le web, et les serveurs MCP déjà configurés. Sers-t'en quand la question demande ce que la base n'a pas — la météo dehors, un fichier, un mail, ce qu'il y a sur une page. Continue d'utiliser la base pour tout ce qui concerne sa journée. Dis ce que tu as fait quand tu sors de la machine.`,
  'de-DE': `Du hast auch den Rest von Claude Code auf diesem Rechner: Dateien lesen, Befehle ausführen, im Web suchen, und die hier schon eingerichteten MCP-Server. Nutze sie, wenn die Frage etwas verlangt, das die Datenbank nicht hat — das Wetter draußen, eine Datei, eine Mail, was auf einer Seite steht. Für alles über seinen Tag bleibt die Datenbank. Sag, was du getan hast, wenn du den Rechner verlässt.`,
}

function persona(): string {
  const language = validLanguage(config.lang)
  const who = PERSONAS[language]
  const now = new Date()
  const intl = LANGUAGES[language].intl
  return [
    HOW_TO_WRITE[language],
    '',
    who.chat(
      config.userName,
      today(),
      now.toLocaleDateString(intl, { weekday: 'long' }),
      now.toTimeString().slice(0, 5),
      config.dayStartHour,
    ),
    '',
    who.tone,
    ...(readSettings().wideTools ? ['', WIDE[language]] : []),
  ].join('\n')
}

export type AgentEvent =
  /** Claude Code's own session, so the next question continues this one. */
  | { type: 'session'; id: string }
  | { type: 'model'; model: string; level: number }
  | { type: 'delta'; text: string }
  | { type: 'text'; text: string }
  | { type: 'tool'; name: string }
  | { type: 'end'; text: string }
  | { type: 'error'; error: string }

/**
 * A tool's name, as it is worth putting on screen.
 *
 * Our own lose the prefix, another server's keeps the server so it is clear
 * where the answer came from, and the SDK's internal schema lookup gets no
 * name at all — it queries nothing, and naming it would only make the panel
 * look busy.
 */
function readable(name: string): string {
  if (name.startsWith('mcp__hippocampus__')) return name.replace('mcp__hippocampus__', '')
  const mcp = name.match(/^mcp__([^_]+(?:_[^_]+)*?)__(.+)$/)
  if (mcp) return `${mcp[1]}: ${mcp[2]}`
  // The lookup the SDK runs to discover the tools it was handed.
  if (/^(ListMcpResources|ReadMcpResource|mcp__)/.test(name)) return ''
  return name
}

/** Talks to Claude Code, with the local database as its tools. */
export async function* chat(prompt: string, sessionId?: string): AsyncGenerator<AgentEvent> {
  // A model that fits the request: jev judges the complexity before it starts.
  // With HIPPOCAMPUS_MODEL set, the choice is yours and the routing steps aside.
  const route = config.claudeModel ? null : await pickModel(prompt)
  if (route) yield { type: 'model', model: route.model, level: route.level }

  /**
   * How far the conversation may reach.
   *
   * Narrow — the default — allows only this app's own tools, so an answer can
   * come from nothing but what was measured on this machine. The MCP servers
   * configured elsewhere on the machine are already loaded by Claude Code
   * underneath; this list is the gate, not their absence.
   *
   * Wide hands over the rest of Claude Code and every one of those servers.
   * The working directory moves to the home folder then, because reading files
   * and running commands from inside the app's data folder would reach almost
   * nothing.
   */
  const wide = readSettings().wideTools

  const run = query({
    prompt,
    options: {
      cwd: wide ? config.home : config.dataDir,
      ...(config.claudeModel ? { model: config.claudeModel } : route ? { model: route.model } : {}),
      ...(sessionId ? { resume: sessionId } : {}),
      permissionMode: 'bypassPermissions',
      // Without this the answer only shows up when the whole block finishes.
      // Measured on a trivial question: the first letter exists at 3s and the
      // block closes at 6.4s — half the wait was just waiting.
      includePartialMessages: true,
      systemPrompt: { type: 'preset', preset: 'claude_code', append: persona() },
      mcpServers: { hippocampus: server },
      // Omitting the list is what opens the gate: Claude Code's own defaults
      // then apply, which is every tool it has plus every MCP server already
      // configured on this machine.
      ...(wide ? {} : { allowedTools: tools.map((tool) => `mcp__hippocampus__${tool.name}`) }),
      // Nothing here can show a dialog and wait for an answer.
      disallowedTools: ['AskUserQuestion'],
    },
  })

  let final = ''
  let told = false
  try {
    for await (const message of run as any) {
      // The text arrives in pieces; the complete block that follows would
      // repeat all of it, so only its tool use matters.
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
            // The SDK's internal schema lookup is not a query against anything,
            // and a name for it on screen means nothing to anyone watching.
            //
            // Everything else is named, including Bash and the other machine's
            // servers: with the wider tools on, what it is reaching for is the
            // one thing worth showing while it works.
            yield { type: 'tool', name: readable(name) }
          }
        }
      }
      // Every message carries it; the conversation only needs to be told once.
      if (message.session_id && !told) {
        told = true
        yield { type: 'session', id: String(message.session_id) }
      }
      if (message.type === 'result') {
        final = message.subtype === 'success' ? message.result ?? '' : ''
        if (message.subtype !== 'success') yield { type: 'error', error: 'Claude Code did not finish the answer.' }
      }
    }
  } catch (error) {
    yield { type: 'error', error: (error as Error).message }
    return
  }
  yield { type: 'end', text: final }
}
