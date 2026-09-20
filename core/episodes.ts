import { db, all } from './db.ts'
import { labelKey, cachedLabel } from './jev.ts'
import { dayOf } from './config.ts'

/**
 * An episode is the unit you can actually search.
 *
 * A block will not do: four seconds in Chrome match no question at all. An
 * episode joins contiguous blocks of the same project — cutting when there are
 * more than 10 minutes of silence — and stitches in, by time window, what
 * junto: commits, o que foi request ao Claude Code, comandos e sites. O text
 * happened. A flattened version of that is what goes into the search index.
 */
const INTERVAL = 600

db.exec(`
create table if not exists episodes (
  id integer primary key,
  started_at integer not null,
  ended_at integer not null,
  minutes integer not null,
  day text not null,
  project text,
  category text,
  apps text,
  titles text,
  hosts text,
  commits text,
  prompts text,
  shell text
);
create index if not exists episodes_day on episodes(day);
create index if not exists episodes_project on episodes(project);

create virtual table if not exists busca using fts5(
  doc,
  episode_id unindexed,
  day unindexed,
  tokenize = "unicode61 remove_diacritics 2"
);
`)

const insert = db.prepare(
  `insert into episodes (started_at, ended_at, minutes, day, project, category,
                         apps, titles, hosts, commits, prompts, shell)
   values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
)
const index = db.prepare('insert into busca (doc, episode_id, day) values (?, ?, ?)')

const unique = (valores: (string | null | undefined)[]) =>
  [...new Set(valores.filter((v): v is string => Boolean(v && v.trim())))]

/** Redoes a day's episodes. Idempotent: it deletes and rebuilds. */
export function buildEpisodes(day: string): number {
  const previous = all<any>('select id from episodes where day = ?', day)
  for (const gone of previous) db.prepare('delete from busca where episode_id = ?').run(gone.id)
  db.prepare('delete from episodes where day = ?').run(day)

  const blocks = all<any>(
    `select started_at, ended_at, seconds, app, title, host from blocks
      where day = ? and idle = 0 order by started_at`, day)
  if (!blocks.length) return 0

  type Grupo = { blocks: any[]; project: string | null; categoria: string | null }
  const groups: Grupo[] = []

  for (const block of blocks) {
    const label = cachedLabel(labelKey(block))
    const project = label?.project ?? null
    const current = groups[groups.length - 1]
    const previous = current?.blocks[current.blocks.length - 1]
    const merged = current
      && current.project === project
      && block.started_at - previous.ended_at <= INTERVAL

    if (merged) {
      current.blocks.push(block)
      // The episode's category is the one of its longest block.
      if (block.seconds > previous.seconds) current.categoria = label?.category ?? current.categoria
    } else {
      groups.push({ blocks: [block], project, categoria: label?.category ?? null })
    }
  }

  let total = 0
  for (const group of groups) {
    const start = group.blocks[0].started_at
    const end = group.blocks[group.blocks.length - 1].ended_at
    const minutes = Math.round((end - start) / 60)
    // An episode under two minutes is noise, not memory.
    if (minutes < 2) continue

    const apps = unique(group.blocks.map((b) => b.app))
    const titles = unique(group.blocks.map((b) => b.title)).slice(0, 25)
    const hosts = unique(group.blocks.map((b) => b.host)).slice(0, 15)

    // Stitch by time window: what happened while the episode lasted.
    const commits = all<any>(
      'select repo, subject from commits where ts between ? and ?', start, end)
      .map((c) => `${c.repo}: ${c.subject}`)
    const prompts = all<any>(
      'select prompt from ai_turns where ts between ? and ? limit 20', start, end)
      .map((p) => String(p.prompt).slice(0, 200))
    const shell = all<any>(
      'select cmd from shell_cmds where ts between ? and ? limit 20', start, end)
      .map((c) => c.cmd)

    const result = insert.run(
      start, end, minutes, day, group.project, group.categoria,
      JSON.stringify(apps), JSON.stringify(titles), JSON.stringify(hosts),
      JSON.stringify(commits), JSON.stringify(prompts), JSON.stringify(shell),
    )

    const doc = [
      group.project ?? '', group.categoria ?? '',
      apps.join(' '), titles.join(' · '), hosts.join(' '),
      commits.join(' · '), prompts.join(' · '), shell.join(' · '),
    ].filter(Boolean).join('\n')
    index.run(doc, Number(result.lastInsertRowid), day)
    total++
  }
  return total
}

/** Rebuilds every day that has blocks and no episodes. */
export function buildAllEpisodes(): { day: string; episodes: number }[] {
  const days = all<any>(
    `select distinct b.day from blocks b
      where not exists (select 1 from episodes e where e.day = b.day) order by b.day`)
  return days.map((line) => ({ day: line.day, episodes: buildEpisodes(line.day) }))
    .filter((r) => r.episodes > 0)
}

export type Episodio = {
  id: number; started_at: number; ended_at: number; minutes: number; day: string
  project: string | null; category: string | null
  apps: string; titles: string; hosts: string; commits: string; prompts: string; shell: string
}

/** Full-text search over episodes, newest first. */
export function searchEpisodes(termo: string, limite = 12): Episodio[] {
  // Doubled quotes become a literal: people write in plain language.
  const lookup = termo.replace(/["']/g, ' ').trim().split(/\s+/)
    .filter(Boolean).map((palavra) => `"${palavra}"`).join(' OR ')
  if (!lookup) return []
  return all<Episodio>(
    `select e.* from busca b join episodes e on e.id = b.episode_id
      where busca match ? order by bm25(busca), e.started_at desc limit ?`,
    lookup, limite)
}

/** The last episode matching the term, and what came right before and after. */
export function lastTime(termo: string) {
  const found = searchEpisodes(termo, 40)
  if (!found.length) return null
  const target = found.reduce((a, b) => (b.started_at > a.started_at ? b : a))
  const neighbours = all<Episodio>(
    `select * from episodes where started_at between ? and ? and id <> ? order by started_at`,
    target.started_at - 7200, target.ended_at + 7200, target.id)
  return { target, neighbours, day: dayOf(target.started_at) }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const result of buildAllEpisodes()) {
    console.log(`${result.day}: ${result.episodes} episodes`)
  }
}
