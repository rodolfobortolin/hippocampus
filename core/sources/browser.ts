import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { config, dayOf } from '../config.ts'
import { db, getMeta, setMeta } from '../db.ts'

// Three browser families, three different time formats — and the database is
// locked while the app runs, which is why everything goes through a copy.
// The read is async on purpose: the folder is protected by macOS and the first
// attempt can end up waiting on a permission dialog.

/** Chromium counts microseconds since 1601; the division happens in SQL so it never overflows JS's safe integer. */
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

const fixed: Fonte[] = [
  { name: 'Chrome', file: 'Library/Application Support/Google/Chrome/Default/History', esquema: CHROMIUM },
  { name: 'Arc', file: 'Library/Application Support/Arc/User Data/Default/History', esquema: CHROMIUM },
  { name: 'Brave', file: 'Library/Application Support/BraveSoftware/Brave-Browser/Default/History', esquema: CHROMIUM },
  { name: 'Edge', file: 'Library/Application Support/Microsoft Edge/Default/History', esquema: CHROMIUM },
  { name: 'Safari', file: 'Library/Safari/History.db', esquema: SAFARI },
]

/** Firefox keeps its history inside a profile whose name varies. */
async function firefoxProfiles(): Promise<Fonte[]> {
  const root = path.join(config.home, 'Library/Application Support/Firefox/Profiles')
  try {
    const profiles = await fs.readdir(root)
    return profiles.map((perfil) => ({
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

// A browser that is installed but has no readable history fails every round.
// The warning is worth saying once; every ten minutes only drowns the log.
const alreadyWarned = new Set<string>()
function warnOnce(source: string, message: string): void {
  const key = `${source}:${message}`
  if (alreadyWarned.has(key)) return
  alreadyWarned.add(key)
  console.error(`[browser] ${source}: ${message}`)
}

function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' }
}

export async function harvestBrowsers(): Promise<{ visits: number }> {
  let total = 0
  for (const source of [...fixed, ...(await firefoxProfiles())]) {
    const original = path.join(config.home, source.file)
    try { await fs.access(original) } catch { continue }

    const copy = path.join(os.tmpdir(), `hippocampus-${source.name.replace(/\W/g, '')}.db`)
    try {
      await fs.copyFile(original, copy)
      for (const suffix of ['-wal', '-shm']) {
        await fs.copyFile(original + suffix, copy + suffix).catch(() => { /* sem wal/shm */ })
      }
    } catch (error) {
      warnOnce(source.name, (error as Error).message)
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
      warnOnce(source.name, (error as Error).message)
    } finally {
      for (const suffix of ['', '-wal', '-shm']) {
        await fs.unlink(copy + suffix).catch(() => { /* already gone */ })
      }
    }
  }
  return { visits: total }
}
