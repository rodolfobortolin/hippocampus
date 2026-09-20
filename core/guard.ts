import fs from 'node:fs/promises'
import { setMeta, getMeta } from './db.ts'

/**
 * "Does this path exist?", without freezing the process when the answer
 * depends on a permission.
 *
 * `fs.existsSync` inside a folder macOS protects does not return an error: it
 * stops, and stops the event loop with it. In a background agent, which has no
 * way to show the consent dialog, it stops forever — the server has already
 * said it is up, no route answers, and the log never gains another line. Async
 * hands control back to the loop, and only then can `withTimeout` below do its
 * job.
 */
export async function exists(path: string): Promise<boolean> {
  try {
    await fs.access(path)
    return true
  } catch {
    return false
  }
}

/**
 * A source's state is stored as a code, not as a sentence.
 *
 * A sentence would change language with the person, and whatever was already
 * in the database would stay stuck in the language of whoever installed the
 * app. The code is stable; the screen is what translates. An unexpected error
 * message passes through as is, because that one comes from the system.
 */
export type SourceState = 'ok' | 'awaiting-permission' | 'no-permission' | 'never' | (string & {})

/**
 * Reads inside folders macOS protects can stall on a permission dialog and
 * never come back. Every harvest goes through here: if it runs out of time,
 * the source is marked as blocked and the rest of the collector stays alive.
 */
export async function withTimeout<T>(
  name: string, ms: number, task: () => Promise<T>,
): Promise<T | null> {
  let finished = false
  const expired = new Promise<null>((resolve) =>
    setTimeout(() => { if (!finished) resolve(null) }, ms))

  try {
    const result = await Promise.race([task().then((value) => { finished = true; return value }), expired])
    if (result === null && !finished) {
      setMeta(`source.${name}`, 'awaiting-permission')
      console.error(`[${name}] no answer in ${ms / 1000}s — probably a macOS permission dialog`)
      return null
    }
    setMeta(`source.${name}`, 'ok')
    return result as T
  } catch (error) {
    const message = (error as NodeJS.ErrnoException).code === 'EPERM'
      ? 'no-permission' : (error as Error).message
    setMeta(`source.${name}`, message)
    console.error(`[${name}] ${message}`)
    return null
  }
}

export function sourceStates(): Record<string, SourceState> {
  const sources = ['skysight', 'browsers', 'claude', 'codex', 'shell', 'git']
  return Object.fromEntries(sources.map((name) => [name, getMeta(`source.${name}`, 'never')]))
}
