import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { config, dayOf } from '../config.ts'
import { db, getMeta, setMeta } from '../db.ts'

// Três famílias de navegador, três formatos de tempo diferentes — e o banco
// fica travado enquanto o app roda, por isso tudo passa por uma cópia.
// A leitura é assíncrona de propósito: a pasta é protegida pelo macOS e a
// primeira tentativa pode ficar esperando um diálogo de permissão.

/** Chromium conta microssegundos desde 1601; a divisão vai no SQL para não estourar o inteiro seguro do JS. */
const CHROMIUM = {
  sql: `select v.visit_time / 1000000 as t, u.url as url, u.title as title
          from visits v join urls u on u.id = v.url
         where v.visit_time / 1000000 > ? order by t limit 20000`,
  paraEpoch: (t: number) => t - 11_644_473_600,
}

/** Safari conta segundos desde 2001. */
const SAFARI = {
  sql: `select v.visit_time as t, i.url as url, v.title as title
          from history_visits v join history_items i on i.id = v.history_item
         where v.visit_time > ? order by t limit 20000`,
  paraEpoch: (t: number) => t + 978_307_200,
}

/** Firefox conta microssegundos desde 1970. */
const FIREFOX = {
  sql: `select h.visit_date / 1000000 as t, p.url as url, p.title as title
          from moz_historyvisits h join moz_places p on p.id = h.place_id
         where h.visit_date / 1000000 > ? order by t limit 20000`,
  paraEpoch: (t: number) => t,
}

type Fonte = { name: string; file: string; esquema: typeof CHROMIUM }

const fixas: Fonte[] = [
  { name: 'Chrome', file: 'Library/Application Support/Google/Chrome/Default/History', esquema: CHROMIUM },
  { name: 'Arc', file: 'Library/Application Support/Arc/User Data/Default/History', esquema: CHROMIUM },
  { name: 'Brave', file: 'Library/Application Support/BraveSoftware/Brave-Browser/Default/History', esquema: CHROMIUM },
  { name: 'Edge', file: 'Library/Application Support/Microsoft Edge/Default/History', esquema: CHROMIUM },
  { name: 'Safari', file: 'Library/Safari/History.db', esquema: SAFARI },
]

/** O Firefox guarda o histórico dentro de um perfil de nome variável. */
async function perfisFirefox(): Promise<Fonte[]> {
  const raiz = path.join(config.home, 'Library/Application Support/Firefox/Profiles')
  try {
    const perfis = await fs.readdir(raiz)
    return perfis.map((perfil) => ({
      name: `Firefox (${perfil.split('.').pop() ?? perfil})`,
      file: path.join('Library/Application Support/Firefox/Profiles', perfil, 'places.sqlite'),
      esquema: FIREFOX,
    }))
  } catch {
    return []
  }
}

const insert = db.prepare(
  `insert or ignore into visits (ts, day, browser, url, host, title) values (?, ?, ?, ?, ?, ?)`,
)

// Navegador instalado mas sem histórico legível falha em toda rodada. O aviso
// vale uma vez; repetir a cada dez minutos só afoga o registro.
const jaAvisado = new Set<string>()
function avisaUmaVez(fonte: string, mensagem: string): void {
  const chave = `${fonte}:${mensagem}`
  if (jaAvisado.has(chave)) return
  jaAvisado.add(chave)
  console.error(`[navegador] ${fonte}: ${mensagem}`)
}

function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' }
}

export async function harvestBrowsers(): Promise<{ visits: number }> {
  let total = 0
  for (const source of [...fixas, ...(await perfisFirefox())]) {
    const original = path.join(config.home, source.file)
    try { await fs.access(original) } catch { continue }

    const copy = path.join(os.tmpdir(), `hipocampo-${source.name.replace(/\W/g, '')}.db`)
    try {
      await fs.copyFile(original, copy)
      for (const suffix of ['-wal', '-shm']) {
        await fs.copyFile(original + suffix, copy + suffix).catch(() => { /* sem wal/shm */ })
      }
    } catch (error) {
      avisaUmaVez(source.name, (error as Error).message)
      continue
    }

    const key = `browser.${source.name}`
    const since = Number(getMeta(key, '0'))
    let latest = since

    try {
      const history = new DatabaseSync(copy, { readOnly: true })
      const rows = history.prepare(source.esquema.sql).all(since) as
        { t: number; url: string; title: string }[]

      for (const row of rows) {
        latest = Math.max(latest, row.t)
        const ts = Math.floor(source.esquema.paraEpoch(row.t))
        if (!Number.isFinite(ts) || ts <= 0) continue
        if (/^(chrome|arc|brave|edge|about|devtools|moz-extension|safari-resource):/i.test(row.url)) continue
        insert.run(ts, dayOf(ts), source.name, row.url.slice(0, 800), hostOf(row.url), row.title ?? '')
        total++
      }
      history.close()
      setMeta(key, String(latest))
    } catch (error) {
      avisaUmaVez(source.name, (error as Error).message)
    } finally {
      for (const suffix of ['', '-wal', '-shm']) {
        await fs.unlink(copy + suffix).catch(() => { /* já não existe */ })
      }
    }
  }
  return { visits: total }
}
