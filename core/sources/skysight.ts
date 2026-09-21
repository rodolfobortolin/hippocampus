import fs from 'node:fs/promises'
import path from 'node:path'
import zlib from 'node:zlib'
import { config, paths, dayOf } from '../config.ts'
import { VERSION } from '../version.ts'
import { db, getMeta, setMeta } from '../db.ts'
import { redact } from '../redact.ts'
import { shortcutLabel, hasModifier } from '../keys.ts'
import { keepsTyping, isSecret } from '../privacy.ts'

// Codex's Computer History writes rich events into a cache it erases itself
// within hours. Here we pick them up before they vanish and keep them.
const segmentsDir = path.join(
  config.home,
  'Library/Group Containers/2DC432GLL2.com.openai.sky.CUAService',
  'Library/Caches/ComputerUse/Skysight/segments',
)

const insertEvent = db.prepare(
  `insert or ignore into events (source_id, ts, day, kind, app, detail, meta) values (?, ?, ?, ?, ?, ?, ?)`,
)
const insertTyping = db.prepare(
  `insert or ignore into typing (source_id, ts, day, app, chars, text) values (?, ?, ?, ?, ?, ?)`,
)

// existsSync in a folder macOS protects freezes the whole process
// while the permission dialog waits for an answer. Here the check is async and
// the result is cached for whoever needs the answer right away.
let available: boolean | null = null

export function skysightAvailable(): boolean {
  return available === true
}

/**
 * A refusal is remembered; a folder that is simply not there is not.
 *
 * This reads inside another app's Group Container, which macOS guards with a
 * dialog of its own. The harvest runs every two minutes, so a refusal that is
 * not remembered becomes that dialog every two minutes — the whole day, from a
 * window that does not say which app is asking or what for. Nobody consents
 * their way out of that; they turn the app off.
 *
 * "Not installed" is a different answer: it costs no dialog, it can change
 * tomorrow, and it stays worth checking.
 */
const DENIED = 'skysight.denied'
const ALLOWED = 'skysight.allowed'

/**
 * How long a "no" is taken at its word before the folder is touched again.
 *
 * macOS remembers a decision against the app's signature, so a rebuilt app is
 * a new app and it asks once more. During development that is every launch,
 * which is how someone ends up clicking the same dialog all day. Six hours
 * bounds it: the answer survives restarts, and if macOS really did forget, the
 * question comes back once, not on every start.
 */
const PATIENCE = 6 * 60 * 60 * 1000

/** Forgets both answers, so the folder is looked at again. */
export function retryDeniedSkysight(): void {
  setMeta(DENIED, '')
  setMeta(ALLOWED, '')
}

/**
 * Asked once per version of the app, not once every two minutes.
 *
 * The harvest runs every two minutes and used to re-ask the filesystem each
 * time. Every one of those is a chance for macOS to raise its dialog, and the
 * dialog does not say which app is asking or what for — so the answer is
 * remembered against the version that asked, and a new build asks once.
 */
export async function checkSkysight(): Promise<boolean> {
  if (getMeta(ALLOWED, '') === VERSION) {
    available = true
    return true
  }
  const refusedAt = Number(getMeta(DENIED, '0'))
  if (refusedAt && Date.now() - refusedAt < PATIENCE) {
    available = false
    return false
  }
  try {
    await fs.access(segmentsDir)
    available = true
    setMeta(ALLOWED, VERSION)
    setMeta(DENIED, '0')
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'EPERM' || code === 'EACCES') {
      setMeta(DENIED, String(Date.now()))
      console.error('[skysight] macOS refused the folder — leaving it alone for six hours')
    }
    available = false
  }
  return available
}


/** Reads the segments not yet harvested and returns how many events got in. */
export async function harvestSkysight(): Promise<{ segments: number; events: number }> {
  if (!(await checkSkysight())) return { segments: 0, events: 0 }
  const done = new Set(JSON.parse(getMeta('skysight.done', '[]')) as string[])
  const names = (await fs.readdir(segmentsDir)).filter((n) => /^\d{4}-/.test(n)).sort()
  // The last segment is still being written; leave it for the next round.
  const pending = names.slice(0, -1).filter((n) => !done.has(n))

  let events = 0
  for (const name of pending) {
    const file = path.join(segmentsDir, name, 'events.jsonl')
    try { await fs.access(file) } catch { done.add(name); continue }

    const archive: string[] = []
    // value acumulado do campo de text, por app+campo — vira a amostra de escrita
    const typed = new Map<string, { ts: number; app: string; chars: number; value: string }>()

    for (const line of (await fs.readFile(file, 'utf8')).split('\n')) {
      if (!line.trim()) continue
      let event: any
      try { event = JSON.parse(line) } catch { continue }

      delete event.ax // the accessibility tree is 90% of the volume and useless later
      archive.push(JSON.stringify(event))

      const ts = Math.floor(new Date(event.timestamp).getTime() / 1000)
      if (!Number.isFinite(ts)) continue
      const day = dayOf(ts)
      const app = event.app?.name ?? null
      const sourceId = `${name}:${event.id}`

      switch (event.kind) {
        case 'keyboard.shortcut': {
          const label = shortcutLabel(event.keyboard)
          if (!label) break // pressing only ⇧ or ⌘ is not a shortcut
          // With no modifier it is just a key (delete, arrow); a real shortcut has ⌘/⌥/⌃/⇧.
          const kind = hasModifier(event.keyboard) ? 'shortcut' : 'key'
          insertEvent.run(sourceId, ts, day, kind, app, label,
            JSON.stringify({ window: event.window?.title ?? null }))
          events++
          break
        }
        case 'window.changed': {
          const secret = isSecret(app, event.window?.title, event.window?.url)
          insertEvent.run(sourceId, ts, day, 'window', app,
            secret ? '' : redact(event.window?.title ?? ''),
            JSON.stringify({ url: secret ? null : event.window?.url ?? null,
                             bundle: event.app?.bundleIdentifier ?? null }))
          events++
          break
        }
        case 'keyboard.submit': {
          const target = event.keyboard?.target ?? {}
          insertEvent.run(sourceId, ts, day, 'submit', app,
            redact(target.description ?? target.title ?? target.placeholder ?? ''),
            JSON.stringify({ value: redact(String(target.value ?? '')).slice(0, 400) }))
          events++
          break
        }
        case 'keyboard.text_input': {
          if (!keepsTyping(app, event.window?.title)) break
          const target = event.keyboard?.target ?? {}
          const field = `${app ?? '?'}|${target.description ?? target.role ?? '?'}`
          const value = String(target.value ?? '')
          const seen = typed.get(field)
          if (!seen || value.length >= seen.value.length) {
            typed.set(field, {
              ts, app: app ?? '?', chars: (seen?.chars ?? 0) + String(event.keyboard?.text ?? '').length, value,
            })
          } else {
            seen.chars += String(event.keyboard?.text ?? '').length
          }
          break
        }
        case 'mouse.click':
        case 'mouse.drag': {
          insertEvent.run(sourceId, ts, day, event.kind === 'mouse.drag' ? 'drag' : 'click', app,
            event.mouse?.target?.role ?? null, null)
          events++
          break
        }
      }
    }

    for (const [field, entry] of typed) {
      const text = redact(entry.value).slice(0, 600)
      if (!text.trim() && !entry.chars) continue
      insertTyping.run(`${name}:${field}`, entry.ts, dayOf(entry.ts), entry.app, entry.chars, text)
      events++
    }

    if (archive.length) {
      const out = path.join(paths.archive, `skysight-${dayOf(new Date(`${name.slice(0, 10)}T12:00:00Z`))}.ndjson.gz`)
      await fs.appendFile(out, zlib.gzipSync(Buffer.from(archive.join('\n') + '\n')))
    }
    done.add(name)
  }

  // Keeps the list lean: only names that can still show up in the cache.
  const keep = [...done].sort().slice(-500)
  setMeta('skysight.done', JSON.stringify(keep))
  return { segments: pending.length, events }
}
