import { db, all } from './db.ts'
import { labelKey, cachedLabel } from './jev.ts'
import { dayOf } from './config.ts'

/**
 * Um episódio é a unidade que dá para procurar.
 *
 * Bloco não serve: quatro segundos no Chrome não casam com pergunta nenhuma.
 * O episódio junta blocos contíguos do mesmo projeto — cortando quando há mais
 * de 10 minutos de silêncio — e costura por janela de tempo o que aconteceu
 * junto: commits, o que foi pedido ao Claude Code, comandos e sites. O texto
 * achatado disso é o que entra no índice de busca.
 */
const INTERVALO = 600

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

const insere = db.prepare(
  `insert into episodes (started_at, ended_at, minutes, day, project, category,
                         apps, titles, hosts, commits, prompts, shell)
   values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
)
const indexa = db.prepare('insert into busca (doc, episode_id, day) values (?, ?, ?)')

const unicos = (valores: (string | null | undefined)[]) =>
  [...new Set(valores.filter((v): v is string => Boolean(v && v.trim())))]

/** Refaz os episódios de um dia. É idempotente: apaga e reconstrói. */
export function buildEpisodes(day: string): number {
  const antigos = all<any>('select id from episodes where day = ?', day)
  for (const antigo of antigos) db.prepare('delete from busca where episode_id = ?').run(antigo.id)
  db.prepare('delete from episodes where day = ?').run(day)

  const blocos = all<any>(
    `select started_at, ended_at, seconds, app, title, host from blocks
      where day = ? and idle = 0 order by started_at`, day)
  if (!blocos.length) return 0

  type Grupo = { blocos: any[]; projeto: string | null; categoria: string | null }
  const grupos: Grupo[] = []

  for (const bloco of blocos) {
    const rotulo = cachedLabel(labelKey(bloco))
    const projeto = rotulo?.project ?? null
    const atual = grupos[grupos.length - 1]
    const anterior = atual?.blocos[atual.blocos.length - 1]
    const emendou = atual
      && atual.projeto === projeto
      && bloco.started_at - anterior.ended_at <= INTERVALO

    if (emendou) {
      atual.blocos.push(bloco)
      // A categoria do episódio é a do bloco mais longo dentro dele.
      if (bloco.seconds > anterior.seconds) atual.categoria = rotulo?.category ?? atual.categoria
    } else {
      grupos.push({ blocos: [bloco], projeto, categoria: rotulo?.category ?? null })
    }
  }

  let total = 0
  for (const grupo of grupos) {
    const comeco = grupo.blocos[0].started_at
    const fim = grupo.blocos[grupo.blocos.length - 1].ended_at
    const minutos = Math.round((fim - comeco) / 60)
    // Episódio de menos de dois minutos é ruído, não memória.
    if (minutos < 2) continue

    const apps = unicos(grupo.blocos.map((b) => b.app))
    const titulos = unicos(grupo.blocos.map((b) => b.title)).slice(0, 25)
    const hosts = unicos(grupo.blocos.map((b) => b.host)).slice(0, 15)

    // Costura pela janela de tempo: o que aconteceu enquanto o episódio durava.
    const commits = all<any>(
      'select repo, subject from commits where ts between ? and ?', comeco, fim)
      .map((c) => `${c.repo}: ${c.subject}`)
    const prompts = all<any>(
      'select prompt from ai_turns where ts between ? and ? limit 20', comeco, fim)
      .map((p) => String(p.prompt).slice(0, 200))
    const shell = all<any>(
      'select cmd from shell_cmds where ts between ? and ? limit 20', comeco, fim)
      .map((c) => c.cmd)

    const resultado = insere.run(
      comeco, fim, minutos, day, grupo.projeto, grupo.categoria,
      JSON.stringify(apps), JSON.stringify(titulos), JSON.stringify(hosts),
      JSON.stringify(commits), JSON.stringify(prompts), JSON.stringify(shell),
    )

    const doc = [
      grupo.projeto ?? '', grupo.categoria ?? '',
      apps.join(' '), titulos.join(' · '), hosts.join(' '),
      commits.join(' · '), prompts.join(' · '), shell.join(' · '),
    ].filter(Boolean).join('\n')
    indexa.run(doc, Number(resultado.lastInsertRowid), day)
    total++
  }
  return total
}

/** Reconstrói todos os dias que têm bloco e nenhum episódio. */
export function buildAllEpisodes(): { day: string; episodes: number }[] {
  const dias = all<any>(
    `select distinct b.day from blocks b
      where not exists (select 1 from episodes e where e.day = b.day) order by b.day`)
  return dias.map((linha) => ({ day: linha.day, episodes: buildEpisodes(linha.day) }))
    .filter((r) => r.episodes > 0)
}

export type Episodio = {
  id: number; started_at: number; ended_at: number; minutes: number; day: string
  project: string | null; category: string | null
  apps: string; titles: string; hosts: string; commits: string; prompts: string; shell: string
}

/** Busca textual nos episódios, da mais recente para a mais antiga. */
export function searchEpisodes(termo: string, limite = 12): Episodio[] {
  // Aspas duplicadas viram literal: o usuário escreve em linguagem natural.
  const consulta = termo.replace(/["']/g, ' ').trim().split(/\s+/)
    .filter(Boolean).map((palavra) => `"${palavra}"`).join(' OR ')
  if (!consulta) return []
  return all<Episodio>(
    `select e.* from busca b join episodes e on e.id = b.episode_id
      where busca match ? order by bm25(busca), e.started_at desc limit ?`,
    consulta, limite)
}

/** O último episódio que casa com o termo, e o que veio logo antes e depois. */
export function lastTime(termo: string) {
  const achados = searchEpisodes(termo, 40)
  if (!achados.length) return null
  const alvo = achados.reduce((a, b) => (b.started_at > a.started_at ? b : a))
  const vizinhos = all<Episodio>(
    `select * from episodes where started_at between ? and ? and id <> ? order by started_at`,
    alvo.started_at - 7200, alvo.ended_at + 7200, alvo.id)
  return { alvo, vizinhos, dia: dayOf(alvo.started_at) }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const resultado of buildAllEpisodes()) {
    console.log(`${resultado.day}: ${resultado.episodes} episódios`)
  }
}
