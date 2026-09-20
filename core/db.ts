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

-- Minutos em que um agente estava trabalhando, com ou sem você na frente.
-- É o que separa "saiu para almoçar" de "delegou e foi fazer outra coisa".
-- A chave inclui o agente: Claude e Codex podem trabalhar no mesmo minuto.
create table if not exists agent_minutes (
  minute integer not null,
  agent text not null default 'claude',
  day text not null,
  project text,
  events integer not null default 0,
  primary key (minute, agent)
);
create index if not exists agent_minutes_day on agent_minutes(day);

create table if not exists meta (key text primary key, value text);
`)

// A primeira versão da tabela tinha só o minuto como chave, o que impedia dois
// agentes no mesmo minuto. Migra preservando o que já foi medido.
const chaveAntiga = (db.prepare('pragma table_info(agent_minutes)').all() as any[])
  .some((c) => c.name === 'minute' && c.pk === 1)
const temColunaAgente = (db.prepare('pragma table_info(agent_minutes)').all() as any[])
  .some((c) => c.name === 'agent')
if (chaveAntiga && !temColunaAgente) {
  db.exec(`
    alter table agent_minutes rename to agent_minutes_antiga;
    create table agent_minutes (
      minute integer not null, agent text not null default 'claude',
      day text not null, project text, events integer not null default 0,
      primary key (minute, agent)
    );
    insert into agent_minutes (minute, agent, day, project, events)
      select minute, 'claude', day, project, events from agent_minutes_antiga;
    drop table agent_minutes_antiga;
  `)
}

// Colunas acrescentadas depois da primeira versão. `alter table` não aceita
// "if not exists", então a checagem é pelo próprio esquema.
const colunasExistentes = new Set(
  (db.prepare('pragma table_info(blocks)').all() as any[]).map((c) => c.name))
for (const [coluna, tipo] of [
  ['keys', 'integer not null default 0'],
  ['clicks', 'integer not null default 0'],
  ['scroll', 'integer not null default 0'],
  ['mic', 'integer not null default 0'],
  ['tela', 'text'],
  ['som', 'integer not null default 0'],
  ['midia', 'text'],
  ['tocando', 'text'],
] as const) {
  if (!colunasExistentes.has(coluna)) db.exec(`alter table blocks add column ${coluna} ${tipo}`)
}

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
