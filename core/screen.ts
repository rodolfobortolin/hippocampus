// What is on the screen right now, taken only when someone asks to be looked at.
//
// Nothing here runs on its own: the one caller is the chat tool, and the chat
// only calls it when the person asked. The picture goes to Claude Code in that
// answer and is deleted before the answer is written — never stored, never
// measured, never part of the day.

import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

const run = promisify(execFile)

/** Claude sees no more than this on the long side; anything bigger is resized on arrival anyway. */
const LONGEST = 1568

export type Shot = { display: number; data: string }

export class NoScreenPermission extends Error {}

/**
 * One JPEG per display, main first.
 *
 * Displays are asked for one at a time with `-D`, because the count is not
 * known up front and asking for a display that does not exist fails exactly
 * like a missing permission does: "could not create image from display".
 * So the first display failing means the permission; a later one failing
 * means there are no more displays.
 */
export async function lookAtScreen(): Promise<Shot[]> {
  const dir = await mkdtemp(path.join(tmpdir(), 'hippocampus-screen-'))
  try {
    const shots: Shot[] = []
    for (let display = 1; display <= 4; display++) {
      const file = path.join(dir, `${display}.jpg`)
      try {
        await run('/usr/sbin/screencapture', ['-x', '-t', 'jpg', '-D', String(display), file], { timeout: 10_000 })
      } catch (error) {
        if (display === 1) throw new NoScreenPermission((error as Error).message)
        break
      }
      await run('/usr/bin/sips', ['-Z', String(LONGEST), '-s', 'formatOptions', '70', file], { timeout: 10_000 })
      shots.push({ display, data: (await readFile(file)).toString('base64') })
    }
    return shots
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}
