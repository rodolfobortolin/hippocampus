import { DatabaseSync } from 'node:sqlite'
import { paths } from './config.ts'

export const db = new DatabaseSync(paths.db)

db.exec(`
pragma journal_mode = wal;
pragma synchronous = normal;

-- Um bloco é um intervalo contínuo no mesmo app/janela. É a unidade de tempo.
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

-- Classificação do jev, memorizada por janela para não repetir chamada.
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

-- Eventos discretos: atalhos, trocas de janela, cliques (vindos do Skysight).
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

-- O que foi digitado, já redigido. Serve para o estilo de escrita.
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

-- Uma linha por sessão do Claude Code: o que você pediu e o que ele usou.
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

-- O dia fechado: números, narrativa e o recap.
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

create table if not exists meta (key text primary key, value text);
`)

export function getMeta(key: string, fallback = ''): string {
  const row = db.prepare('select value from meta where key = ?').get(key) as { value?: string } | undefined
  return row?.value ?? fallback
}

export function setMeta(key: string, value: string): void {
  db.prepare('insert into meta(key, value) values (?, ?) on conflict(key) do update set value = excluded.value')
    .run(key, value)
}

export function all<T = any>(sql: string, ...params: any[]): T[] {
  return db.prepare(sql).all(...params) as T[]
}

export function one<T = any>(sql: string, ...params: any[]): T | undefined {
  return db.prepare(sql).get(...params) as T | undefined
}
