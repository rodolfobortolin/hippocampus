import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { config, dayOf } from '../config.ts'
import { db, getMeta, setMeta } from '../db.ts'

// Navegadores Chromium guardam o histórico num SQLite travado enquanto o app roda.
// A cópia resolve, e o tempo deles é microssegundos desde 1601.
// A leitura é assíncrona de propósito: a pasta é protegida pelo macOS e a
// primeira tentativa pode ficar esperando um diálogo de permissão.
const CHROMIUM_EPOCH_OFFSET = 11_644_473_600

const sources = [
  { name: 'Chrome', file: 'Library/Application Support/Google/Chrome/Default/History' },
  { name: 'Arc', file: 'Library/Application Support/Arc/User Data/Default/History' },
  { name: 'Brave', file: 'Library/Application Support/BraveSoftware/Brave-Browser/Default/History' },
  { name: 'Edge', file: 'Library/Application Support/Microsoft Edge/Default/History' },
]

const insert = db.prepare(
  `insert or ignore into visits (ts, day, browser, url, host, title) values (?, ?, ?, ?, ?, ?)`,
)

function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' }
}

export async function harvestBrowsers(): Promise<{ visits: number }> {
  let total = 0
  for (const source of sources) {
    const original = path.join(config.home, source.file)
    try { await fs.access(original) } catch { continue }

    const copy = path.join(os.tmpdir(), `hipocampo-${source.name}.db`)
    try {
      await fs.copyFile(original, copy)
      for (const suffix of ['-wal', '-shm']) {
        await fs.copyFile(original + suffix, copy + suffix).catch(() => { /* sem wal/shm */ })
      }
    } catch (error) {
      console.error(`[navegador] ${source.name}: ${(error as Error).message}`)
      continue
    }

    const key = `browser.${source.name}`
    const since = Number(getMeta(key, '0'))
    let latest = since

    try {
      const history = new DatabaseSync(copy, { readOnly: true })
      // A divisão vai no SQL: em microssegundos o valor passa do inteiro seguro do JS.
      const rows = history.prepare(
        `select v.visit_time / 1000000 as t, u.url as url, u.title as title
           from visits v join urls u on u.id = v.url
          where v.visit_time / 1000000 > ? order by t limit 20000`,
      ).all(since) as { t: number; url: string; title: string }[]

      for (const row of rows) {
        latest = Math.max(latest, row.t)
        const ts = Math.floor(row.t - CHROMIUM_EPOCH_OFFSET)
        if (!Number.isFinite(ts) || ts <= 0) continue
        if (/^(chrome|arc|brave|edge|about|devtools):/i.test(row.url)) continue
        insert.run(ts, dayOf(ts), source.name, row.url.slice(0, 800), hostOf(row.url), row.title ?? '')
        total++
      }
      history.close()
      setMeta(key, String(latest))
    } catch (error) {
      console.error(`[navegador] ${source.name}: ${(error as Error).message}`)
    } finally {
      for (const suffix of ['', '-wal', '-shm']) {
        await fs.unlink(copy + suffix).catch(() => { /* já não existe */ })
      }
    }
  }
  return { visits: total }
}
