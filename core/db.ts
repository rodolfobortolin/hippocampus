import { DatabaseSync } from 'node:sqlite'
import { paths } from './config.ts'
import { humanText } from './prompts.ts'

export const db = new DatabaseSync(paths.db)

// Wait for a lock instead of failing at once. More than one process opens this
// file — the collector under launchd, the app's own core, a rollup run by hand
// — and every one of them writes a little on startup, in the migrations below.
// Without a timeout the second writer gets "database is locked" immediately,
// which is how a test run failed one time in six while the collector was busy.
db.exec('pragma busy_timeout = 5000')

db.exec(`
pragma journal_mode = wal;
pragma synchronous = normal;

-- A block is a continuous stretch in the same app and window. The unit of time.
create table if not exists blocks (
  id integer primary key,
  started_at integer not null,
  ended_at integer not null,
  seconds integer not null,
  day text not null,
  app text,
  bundle text,
  title text,
  url text,
  host text,
  idle integer not null default 0
);
create index if not exists blocks_day on blocks(day);
create index if not exists blocks_started on blocks(started_at);

-- jev's classification, memoised per window so the same window never costs two calls.
create table if not exists labels (
  key text primary key,
  app text,
  sample_title text,
  category text,
  project text,
  deep_work real,
  confidence real,
  model text,
  created_at integer
);

-- Discrete events: shortcuts, window switches, clicks (from Skysight).
create table if not exists events (
  id integer primary key,
  source_id text unique,
  ts integer not null,
  day text not null,
  kind text not null,
  app text,
  detail text,
  meta text
);
create index if not exists events_day on events(day, kind);

-- What was typed, already redacted. This is what carries writing style.
create table if not exists typing (
  id integer primary key,
  source_id text unique,
  ts integer not null,
  day text not null,
  app text,
  chars integer not null,
  text text
);
create index if not exists typing_day on typing(day);

create table if not exists visits (
  id integer primary key,
  ts integer not null,
  day text not null,
  browser text,
  url text,
  host text,
  title text,
  unique(browser, url, ts)
);
create index if not exists visits_day on visits(day);

create table if not exists commits (
  id integer primary key,
  sha text,
  repo text,
  ts integer not null,
  day text not null,
  subject text,
  files integer,
  insertions integer,
  deletions integer,
  unique(repo, sha)
);
create index if not exists commits_day on commits(day);

-- One row per Claude Code turn: what you asked and which tools it used.
create table if not exists ai_turns (
  id integer primary key,
  source_id text unique,
  ts integer not null,
  day text not null,
  project text,
  session text,
  prompt text,
  tools text
);
create index if not exists ai_turns_day on ai_turns(day);

create table if not exists shell_cmds (
  id integer primary key,
  ts integer not null,
  day text not null,
  cmd text,
  unique(ts, cmd)
);
create index if not exists shell_day on shell_cmds(day);

-- The closed day: the numbers, the narrative and the recap.
create table if not exists days (
  day text primary key,
  active_seconds integer,
  idle_seconds integer,
  focus_ratio real,
  switches integer,
  first_at integer,
  last_at integer,
  top_app text,
  stats text,
  narrative text,
  recap text,
  built_at integer
);

-- Minutes an agent spent working, with or without you in front of the machine.
-- This is what separates "went to lunch" from "delegated and did something else".
-- A key inclui o agente: Claude e Codex podem trabalhar no mesmo minute.
create table if not exists agent_minutes (
  minute integer not null,
  agent text not null default 'claude',
  day text not null,
  project text,
  events integer not null default 0,
  primary key (minute, agent)
);
create index if not exists agent_minutes_day on agent_minutes(day);

-- When someone was at the Mac, from macOS's own record of input: from the
-- first key or pointer movement after an absence to the last one before the
-- next. The system keeps a week of it and records it whether or not the
-- collector is running, so it is copied here to outlive the week.
create table if not exists presence (
  started_at integer primary key,
  ended_at integer not null,
  day text not null
);
create index if not exists presence_day on presence(day);

-- Which branch each repository was switched to, and when, from git's reflog.
-- A branch often carries the ticket it is for, which ties the commits, the
-- questions to an agent and the agent's own minutes in that repository to it.
create table if not exists branches (
  repo text not null,
  ts integer not null,
  day text not null,
  branch text not null,
  from_branch text,
  primary key (repo, ts, branch)
);
create index if not exists branches_repo on branches(repo, ts);

create table if not exists meta (key text primary key, value text);
`)

// The table's first version had only the minute as its key, which kept two
// agents from sharing a minute. Migrates without losing what was measured.
const oldKey = (db.prepare('pragma table_info(agent_minutes)').all() as any[])
  .some((c) => c.name === 'minute' && c.pk === 1)
const hasAgentColumn = (db.prepare('pragma table_info(agent_minutes)').all() as any[])
  .some((c) => c.name === 'agent')
if (oldKey && !hasAgentColumn) {
  db.exec(`
    alter table agent_minutes rename to agent_minutes_old;
    create table agent_minutes (
      minute integer not null, agent text not null default 'claude',
      day text not null, project text, events integer not null default 0,
      primary key (minute, agent)
    );
    insert into agent_minutes (minute, agent, day, project, events)
      select minute, 'claude', day, project, events from agent_minutes_old;
    drop table agent_minutes_old;
  `)
}

const blockColumns = () => new Set(
  (db.prepare('pragma table_info(blocks)').all() as any[]).map((c) => c.name as string))

// Columns that were named in Portuguese before the project went English. A
// rename in SQLite is cheap and keeps every row: dropping and recreating them
// would throw away months of screen, sound and now-playing history.
for (const [before, after] of [
  ['tela', 'screen'], ['som', 'sound'], ['midia', 'media'], ['tocando', 'playing'],
] as const) {
  const columns = blockColumns()
  if (columns.has(before) && !columns.has(after)) {
    db.exec(`alter table blocks rename column ${before} to ${after}`)
  }
}

// Columns added after the first version. `alter table` takes no "if not
// exists", so the schema itself is what gets checked.
const existing = blockColumns()
for (const [column, type] of [
  ['keys', 'integer not null default 0'],
  ['clicks', 'integer not null default 0'],
  ['scroll', 'integer not null default 0'],
  ['mic', 'integer not null default 0'],
  ['screen', 'text'],
  ['sound', 'integer not null default 0'],
  ['media', 'text'],
  ['playing', 'text'],
] as const) {
  if (!existing.has(column)) db.exec(`alter table blocks add column ${column} ${type}`)
}

// The category keys travelled with the rename. They are identifiers stored in
// rows, so the rows already carrying the old ones have to move too — otherwise
// every window classified before today would read as uncategorised.
for (const [before, after] of [
  ['codigo', 'code'], ['ia', 'ai'], ['pesquisa', 'research'],
  ['comunicacao', 'communication'], ['escrita', 'writing'],
  ['distracao', 'distraction'], ['sem rótulo', 'unlabelled'],
] as const) {
  db.prepare('update labels set category = ? where category = ?').run(after, before)
}

// The commits the harvest used to keep once per hash. A rewritten history left
// up to three rows for one piece of work; the newest row wins, since it carries
// the hash, the name and the message the repository has now. Empty commits are
// left alone — two merges in one second share a fingerprint without being the
// same work. Running it again finds nothing to do.
db.exec(`
  delete from commits where files > 0 and id not in (
    select max(id) from commits where files > 0 group by ts, files, insertions, deletions
  )
`)

export function getMeta(key: string, fallback = ''): string {
  const row = db.prepare('select value from meta where key = ?').get(key) as { value?: string } | undefined
  return row?.value ?? fallback
}

export function setMeta(key: string, value: string): void {
  db.prepare('insert into meta(key, value) values (?, ?) on conflict(key) do update set value = excluded.value')
    .run(key, value)
}

// Turns an agent's log calls "user" that no person typed — a background task
// announcing itself, /model's output, the list of plugins — were stored as
// requests until the harvesters learned to tell them apart (core/prompts.ts).
// Once, on the rows already here: the machine ones go, the wrapped ones keep
// the person's words. The logs they came from are still on disk.
if (getMeta('prompts.human') !== '1') {
  const drop = db.prepare('delete from ai_turns where id = ?')
  const keep = db.prepare('update ai_turns set prompt = ? where id = ?')
  for (const row of db.prepare('select id, prompt from ai_turns').all() as { id: number; prompt: string | null }[]) {
    const text = humanText(row.prompt)
    if (text === null) drop.run(row.id)
    else if (text !== row.prompt) keep.run(text, row.id)
  }
  setMeta('prompts.human', '1')
}

export function all<T = any>(sql: string, ...params: any[]): T[] {
  return db.prepare(sql).all(...params) as T[]
}

export function one<T = any>(sql: string, ...params: any[]): T | undefined {
  return db.prepare(sql).get(...params) as T | undefined
}
