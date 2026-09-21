import { db } from './db.ts'
import { hoursAndMinutes } from './clock.ts'
import { config, dayOf, today } from './config.ts'
import { dayReport } from './metrics.ts'
import { classifyDay } from './jev.ts'
import { buildEpisodes } from './episodes.ts'
import { knownProjects } from './metrics.ts'
import { ask } from './claude.ts'
import { writeDaySection } from './vault.ts'
import { HOW_TO_WRITE, VAULT_HEADING, validLanguage } from './languages.ts'
import { PERSONAS } from './personas.ts'
import { DOSSIER } from './dossier.ts'

const hours = hoursAndMinutes
const clock = (ts: number | null) => (ts ? new Date(ts * 1000).toTimeString().slice(0, 5) : '—')

/**
 * O material do day para o modelo.
 *
 * `summary` returns only the headline numbers — that answers 90% of the
 * questions, and sending the whole day to extract one number makes the model
 * read 1,500 tokens for nothing. `full` exists for writing the narrative,
 * where the detail is the product.
 */
export function dossier(day: string, level: 'resumo' | 'completo' = 'completo'): string {
  const report = dayReport(day)
  const d = DOSSIER[validLanguage(config.lang)]
  const lines: string[] = [
    d.header(day, hours(report.activeSeconds)),
    report.delegatedSeconds > 300
      ? d.delegated(hours(report.delegatedSeconds), hours(report.awaySeconds))
      : d.idle(hours(report.idleSeconds)),
    d.window(clock(report.firstAt), clock(report.lastAt)),
    d.switches(report.switches, report.switchesProject),
    d.focus(hours(report.focusSeconds), hours(report.activeSeconds), Math.round(report.focusRatio * 100)),
    report.focusShape.sessions
      ? d.sessions(report.focusShape.sessions, report.focusShape.longest, report.focusShape.median,
          report.focusShape.bands.filter((f) => f.minutes).map((f) => `${f.name}min → ${f.minutes}min`).join(', '))
      : d.noSession,
    '',
    d.byApp,
    ...report.apps.map((a) => `- ${a.name}: ${hours(a.seconds)}`),
  ]

  if (report.categories.length) {
    lines.push('', d.byCategory, ...report.categories.map((c) => `- ${c.name}: ${hours(c.seconds)}`))
  }
  if (report.projects.length) {
    lines.push('', d.byProject, ...report.projects.map((p) => `- ${p.name}: ${hours(p.seconds)}`))
  }

  if (level === 'resumo') {
    lines.push('', d.alsoMeasured(report.commits.length, report.aiTurns.length, report.visits, report.windows.length))
    return lines.join('\n')
  }
  if (report.windows.length) {
    lines.push('', d.windows, ...report.windows.slice(0, 10).map((w) => `- ${w.app} · ${w.title} (${hours(w.seconds)})`))
  }
  if (report.commits.length) {
    lines.push('', d.commits, ...report.commits.map((c) => `- ${c.repo}: ${c.subject} (+${c.insertions}/-${c.deletions})`))
  }
  if (report.aiTurns.length) {
    lines.push('', d.requests(report.aiTurns.length),
      ...report.aiTurns.slice(0, 25).map((t) => `- [${t.project}] ${String(t.prompt).slice(0, 180)}`))
  }
  if (report.hosts.length) {
    lines.push('', d.sites, ...report.hosts.map((h) => `- ${h.name} (${h.n})`))
  }
  if (report.shortcuts.length) {
    lines.push('', d.shortcuts, report.shortcuts.map((s) => `${s.name}×${s.n}`).join(', '))
  }
  const typing = db.prepare(
    `select app, text from typing where day = ? and length(text) > 40 order by length(text) desc limit 8`).all(day) as any[]
  if (typing.length) {
    lines.push('', d.typed, ...typing.map((t) => `- [${t.app}] ${t.text.slice(0, 200)}`))
  }
  return lines.join('\n')
}

/** Fecha o day: classifica com o jev, mede, e pede narrativa e recap ao Claude Code. */
export async function rollup(day: string, options: { narrate?: boolean } = {}): Promise<{
  day: string; classified: number; episodes: number; narrative: string; recap: string; vaultFile: string | null
}> {
  const classified = await classifyDay(day, knownProjects())
  // Episodes come after classification: jev's project is what groups them.
  const episodes = buildEpisodes(day)
  const report = dayReport(day)
  const material = dossier(day)

  const language = validLanguage(config.lang)
  const who = PERSONAS[language]
  const persona = [HOW_TO_WRITE[language], '', who.journal(config.userName), '', who.tone].join('\n')

  let narrative = ''
  let recap = ''

  if (options.narrate !== false && report.activeSeconds > 300) {
    narrative = await ask(who.summary(day).replace('%DATA%', material), persona)
    recap = await ask(who.recap(day).replace('%DATA%', material), persona)
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
      `**${hours(report.activeSeconds)} from your own hands**` +
      (report.delegatedSeconds > 300 ? ` · ${hours(report.delegatedSeconds)} delegado a agents` : '') +
      ` · ${clock(report.firstAt)}–${clock(report.lastAt)} · ` +
      `${hours(report.focusSeconds)} focused across ${report.focusShape.sessions} sessions ` +
      `(maior ${report.focusShape.longest}min) · ${report.switches} trocas, ${report.switchesProject} de project`,
      '',
      narrative,
      '',
      report.apps.slice(0, 5).map((a) => `${a.name} ${hours(a.seconds)}`).join(' · '),
    ].join('\n')
    vaultFile = writeDaySection(day, body, VAULT_HEADING[language])
  }

  return { day, classified, episodes, narrative, recap, vaultFile }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = process.argv.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a))
  const day = arg ?? dayOf(Date.now() / 1000 - 86_400)
  const narrate = !process.argv.includes('--no-narrative')
  rollup(day, { narrate }).then((result) => {
    console.log(`day ${result.day}: ${result.classified} windows classified, ${result.episodes} episodes`)
    if (result.narrative) console.log('\n' + result.narrative)
    if (result.recap) console.log('\n' + result.recap)
    if (result.vaultFile) console.log('\nvault:', result.vaultFile)
    process.exit(0)
  })
}
