import { db } from './db.ts'
import { config, dayOf, today } from './config.ts'
import { dayReport } from './metrics.ts'
import { classifyDay } from './jev.ts'
import { knownProjects } from './metrics.ts'
import { ask } from './claude.ts'
import { writeDaySection } from './vault.ts'

const hours = (seconds: number) => `${Math.floor(seconds / 3600)}h${String(Math.round((seconds % 3600) / 60)).padStart(2, '0')}`
const clock = (ts: number | null) => (ts ? new Date(ts * 1000).toTimeString().slice(0, 5) : '—')

/** O material bruto do dia, em texto curto, para o modelo escrever em cima. */
export function dossier(day: string): string {
  const report = dayReport(day)
  const lines: string[] = [
    `Dia ${day}. Ativo ${hours(report.activeSeconds)}, ocioso ${hours(report.idleSeconds)}.`,
    `Começou ${clock(report.firstAt)}, parou ${clock(report.lastAt)}. ${report.switches} trocas de aplicativo.`,
    `Foco medido: ${Math.round(report.focusRatio * 100)}%.`,
    '',
    'Tempo por aplicativo:',
    ...report.apps.map((a) => `- ${a.name}: ${hours(a.seconds)}`),
  ]

  if (report.categories.length) {
    lines.push('', 'Por categoria:', ...report.categories.map((c) => `- ${c.name}: ${hours(c.seconds)}`))
  }
  if (report.projects.length) {
    lines.push('', 'Por projeto:', ...report.projects.map((p) => `- ${p.name}: ${hours(p.seconds)}`))
  }
  if (report.windows.length) {
    lines.push('', 'Janelas onde mais ficou:',
      ...report.windows.slice(0, 10).map((w) => `- ${w.app} · ${w.title} (${hours(w.seconds)})`))
  }
  if (report.commits.length) {
    lines.push('', 'Commits:', ...report.commits.map((c) => `- ${c.repo}: ${c.subject} (+${c.insertions}/-${c.deletions})`))
  }
  if (report.aiTurns.length) {
    lines.push('', `Pedidos ao Claude Code (${report.aiTurns.length}):`,
      ...report.aiTurns.slice(0, 25).map((t) => `- [${t.project}] ${String(t.prompt).slice(0, 180)}`))
  }
  if (report.hosts.length) {
    lines.push('', 'Sites mais visitados:', ...report.hosts.map((h) => `- ${h.name} (${h.n})`))
  }
  if (report.shortcuts.length) {
    lines.push('', 'Atalhos:', report.shortcuts.map((s) => `${s.name}×${s.n}`).join(', '))
  }
  const typing = db.prepare(
    `select app, text from typing where day = ? and length(text) > 40 order by length(text) desc limit 8`).all(day) as any[]
  if (typing.length) {
    lines.push('', 'Amostras do que digitou:', ...typing.map((t) => `- [${t.app}] ${t.text.slice(0, 200)}`))
  }
  return lines.join('\n')
}

const PERSONA = `Você escreve o diário de computador do ${config.userName}, em português do Brasil.
Fale direto com ele, na segunda pessoa. Sem elogio vazio, sem "parabéns", sem encher linguiça.
Use os números que recebeu — hora, duração, contagem — em vez de adjetivos.
Quando um número for pequeno demais para sustentar uma conclusão, diga isso em vez de inventar.`

/** Fecha o dia: classifica com o jev, mede, e pede narrativa e recap ao Claude Code. */
export async function rollup(day: string, options: { narrate?: boolean } = {}): Promise<{
  day: string; classified: number; narrative: string; recap: string; vaultFile: string | null
}> {
  const classified = await classifyDay(day, knownProjects())
  const report = dayReport(day)
  const material = dossier(day)

  let narrative = ''
  let recap = ''

  if (options.narrate !== false && report.activeSeconds > 300) {
    narrative = await ask(
      `Escreva o resumo do dia ${day} a partir destes dados medidos no computador.\n\n` +
      `${material}\n\n` +
      `Formato: 3 a 6 marcadores. Cada um junta um número a um fato concreto ` +
      `(qual projeto, qual janela, qual commit). Comece pelo que dominou o dia. ` +
      `Se houve troca de contexto demais, diga com o número de trocas. Só os marcadores, sem título.`,
      PERSONA,
    )

    recap = await ask(
      `A partir dos mesmos dados, escreva um recap divertido do dia ${day}.\n\n` +
      `${material}\n\n` +
      `Quatro parágrafos curtos, nesta ordem e com estes títulos em negrito:\n` +
      `**Seu padrão** — como você trabalhou de fato.\n` +
      `**Suas distrações** — o que roubou tempo, dito com graça.\n` +
      `**Atalhos e escrita** — sua assinatura de teclado e o jeito como você escreve, com exemplo.\n` +
      `**Zoeira** — uma provocação leve, afiada, sem crueldade.\n` +
      `Baseie cada piada num dado real da lista. Se faltar dado para um parágrafo, diga em uma linha.`,
      PERSONA,
    )
  }

  const stats = {
    apps: report.apps, categories: report.categories, projects: report.projects,
    switches: report.switches, clicks: report.clicks, typing: report.typing,
    commits: report.commits.length, visits: report.visits, aiTurns: report.aiTurns.length,
  }

  db.prepare(
    `insert into days (day, active_seconds, idle_seconds, focus_ratio, switches, first_at, last_at,
                       top_app, stats, narrative, recap, built_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     on conflict(day) do update set active_seconds = excluded.active_seconds,
       idle_seconds = excluded.idle_seconds, focus_ratio = excluded.focus_ratio,
       switches = excluded.switches, first_at = excluded.first_at, last_at = excluded.last_at,
       top_app = excluded.top_app, stats = excluded.stats,
       narrative = case when excluded.narrative <> '' then excluded.narrative else days.narrative end,
       recap = case when excluded.recap <> '' then excluded.recap else days.recap end,
       built_at = excluded.built_at`,
  ).run(day, report.activeSeconds, report.idleSeconds, report.focusRatio, report.switches,
    report.firstAt, report.lastAt, report.apps[0]?.name ?? null, JSON.stringify(stats),
    narrative, recap, Math.floor(Date.now() / 1000))

  let vaultFile: string | null = null
  if (narrative) {
    const body = [
      `**${hours(report.activeSeconds)} ativo** · ${clock(report.firstAt)}–${clock(report.lastAt)} · ` +
      `foco ${Math.round(report.focusRatio * 100)}% · ${report.switches} trocas de app`,
      '',
      narrative,
      '',
      report.apps.slice(0, 5).map((a) => `${a.name} ${hours(a.seconds)}`).join(' · '),
    ].join('\n')
    vaultFile = writeDaySection(day, body)
  }

  return { day, classified, narrative, recap, vaultFile }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = process.argv.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a))
  const day = arg ?? dayOf(Date.now() / 1000 - 86_400)
  const narrate = !process.argv.includes('--sem-narrativa')
  rollup(day, { narrate }).then((result) => {
    console.log(`dia ${result.day}: ${result.classified} janelas classificadas`)
    if (result.narrative) console.log('\n' + result.narrative)
    if (result.recap) console.log('\n' + result.recap)
    if (result.vaultFile) console.log('\nvault:', result.vaultFile)
    process.exit(0)
  })
}
