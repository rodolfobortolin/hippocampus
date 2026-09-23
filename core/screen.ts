// What is on the screen right now, taken only when someone asks to be looked at.
//
// Nothing here runs on its own: the one caller is the chat tool, and the chat
// only calls it when the person asked. The picture goes to Claude Code in that
// answer and is deleted before the answer is written — never stored, never
// measured, never part of the day.

import { execFile } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { access, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const run = promisify(execFile)

/** Claude sees no more than this on the long side; anything bigger is resized on arrival anyway. */
const LONGEST = 1568

/** Where a display sits, in the global space Electron also uses: points, origin top-left of the main display. */
export type Frame = { x: number; y: number; width: number; height: number }

export type Shot = {
  screen: number
  /** How many displays there are, whether or not all were taken. */
  of?: number
  data: string
  /** Absent when the picture came from `screencapture`, which does not say where the display is. */
  frame?: Frame
  pixelWidth?: number
  pixelHeight?: number
  hasCursor?: boolean
}

export class NoScreenPermission extends Error {}
export class NoAccessibility extends Error {}

/**
 * The last pictures, kept only as geometry — which display, where, at what
 * size — so that a point in a picture can become a place on the screen. The
 * pixels themselves are gone by then.
 */
let lastLook: { at: number; screens: Map<number, { frame: Frame; pixelWidth: number; pixelHeight: number }> } | undefined

/**
 * The helper, beside the app's own binary in the bundle or in `native/bin` in
 * the repository. Looked up on each use and asynchronously: a synchronous look
 * into `~/Documents` from a background agent can hang on a permission prompt.
 */
async function helper(): Promise<string | undefined> {
  const here = path.dirname(fileURLToPath(import.meta.url))
  const candidates = [
    path.join(here, '..', 'native', 'bin', 'hippocampus-screen'),          // repository
    path.join(here, '..', '..', '..', 'MacOS', 'hippocampus-screen'),      // packaged bundle
  ]
  for (const candidate of candidates) {
    try { await access(candidate); return candidate } catch { /* next */ }
  }
  return undefined
}

/**
 * The display under the cursor, or every display with `all`.
 *
 * Through the helper, Hippocampus's own windows — the sphere, the pointer —
 * are left out of the picture. Without it (a repository with no native build,
 * or macOS 13) it falls back to `screencapture`, which includes them and
 * cannot say where each display sits, so pointing is not possible from those
 * pictures.
 */
export async function lookAtScreen({ all = false } = {}): Promise<Shot[]> {
  const dir = await mkdtemp(path.join(tmpdir(), 'hippocampus-screen-'))
  try {
    const native = await helper()
    if (native) {
      try {
        const { stdout } = await run(native, ['--out', dir, '--max', String(LONGEST), ...(all ? [] : ['--cursor-only'])],
          { timeout: 15_000 })
        const parsed = JSON.parse(stdout) as {
          screens: { screen: number; of: number; frame: Frame; pixelWidth: number; pixelHeight: number; hasCursor: boolean; file: string }[]
        }
        const shots: Shot[] = []
        for (const s of parsed.screens) {
          shots.push({ ...s, data: (await readFile(s.file)).toString('base64') })
        }
        lastLook = {
          at: Date.now(),
          screens: new Map(parsed.screens.map((s) => [s.screen, { frame: s.frame, pixelWidth: s.pixelWidth, pixelHeight: s.pixelHeight }])),
        }
        return shots
      } catch (error: any) {
        if (error?.code === 2) throw new NoScreenPermission(String(error.stderr ?? error.message))
        if (error?.code !== 3) throw error
        // macOS 13: no ScreenCaptureKit screenshots. Fall through.
      }
    }
    return await withScreencapture(dir, all)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

/**
 * One display at a time with `-D`, because asking for a display that does not
 * exist fails exactly like a missing permission does: "could not create image
 * from display". So the first display failing means the permission; a later
 * one failing means there are no more displays.
 */
async function withScreencapture(dir: string, all: boolean): Promise<Shot[]> {
  lastLook = undefined
  const shots: Shot[] = []
  for (let display = 1; display <= (all ? 4 : 1); display++) {
    const file = path.join(dir, `${display}.jpg`)
    try {
      await run('/usr/sbin/screencapture', ['-x', '-t', 'jpg', '-D', String(display), file], { timeout: 10_000 })
    } catch (error) {
      if (display === 1) throw new NoScreenPermission((error as Error).message)
      break
    }
    await run('/usr/bin/sips', ['-Z', String(LONGEST), '-s', 'formatOptions', '70', file], { timeout: 10_000 })
    shots.push({ screen: display, data: (await readFile(file)).toString('base64') })
  }
  return shots
}

/**
 * A click at a pixel of the latest picture.
 *
 * The pointer flies there first and the click waits for it to land: a click
 * that happens where nobody was looking is a click nobody can check.
 */
export async function clickOnScreen(
  screen: number, x: number, y: number, label: string, { double = false, right = false } = {},
): Promise<boolean> {
  const place = placeOnScreen(screen, x, y)
  const native = await helper()
  if (!place || !native) return false
  pointing.emit('point', { ...place, label })
  await new Promise((resolve) => setTimeout(resolve, 900))
  try {
    await run(native, ['click', '--x', String(place.x), '--y', String(place.y),
      ...(double ? ['--double'] : []), ...(right ? ['--right'] : [])], { timeout: 10_000 })
  } catch (error: any) {
    if (error?.code === 4) throw new NoAccessibility(String(error.stderr ?? error.message))
    throw error
  }
  // What was on screen before the click no longer is.
  lastLook = undefined
  return true
}

export type Control = { path: string; role: string; label: string; x: number; y: number; width: number; height: number }
export type Controls = { app: string; pid: number; window: string; controls: Control[]; ms: number }

export class NoControls extends Error {}

/** What can be pressed in the window on top — or in the app named — read from Accessibility. */
export async function listControls(app?: string, { text = false } = {}): Promise<Controls> {
  const native = await helper()
  if (!native) throw new NoControls('the screen helper is not built')
  try {
    const { stdout } = await run(native, ['controls', ...(app ? ['--app', app] : []), ...(text ? ['--text'] : [])],
      { timeout: 8_000, maxBuffer: 4 * 1024 * 1024 })
    return JSON.parse(stdout) as Controls
  } catch (error: any) {
    if (error?.code === 4) throw new NoAccessibility(String(error.stderr ?? error.message))
    throw new NoControls(String(error?.stderr || error?.message || error).trim())
  }
}

/** Presses one control: the pointer goes there first, where the person can see it. */
export async function pressControl(where: Controls, control: Control): Promise<string> {
  const native = await helper()
  if (!native) throw new NoControls('the screen helper is not built')
  pointing.emit('point', { x: Math.round(control.x), y: Math.round(control.y), label: control.label.slice(0, 40) })
  // Shorter than a click from a picture: the place is exact, and the pointer
  // is there to show what happened, not to be checked before it happens.
  await new Promise((resolve) => setTimeout(resolve, 450))
  try {
    const { stdout } = await run(native, ['press', '--pid', String(where.pid), '--role', control.role, '--label', control.label,
      '--x', String(control.x), '--y', String(control.y)], { timeout: 8_000 })
    lastLook = undefined
    return JSON.parse(stdout).via
  } catch (error: any) {
    if (error?.code === 4) throw new NoAccessibility(String(error.stderr ?? error.message))
    if (error?.code === 7) throw new NoControls('it cannot be pressed without the mouse; use click on its place instead')
    throw new NoControls(String(error?.stderr || error?.message || error).trim())
  }
}

/**
 * The controls whose name contains every word of the request, for the cases
 * that need no judgement at all — "click Save" when one control is called
 * "Save". Accents and case do not count.
 */
export function plainMatches(target: string, controls: Control[]): Control[] {
  const fold = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const words = fold(target).split(/[^\p{L}\p{N}]+/u).filter((word) => word.length > 1)
  if (!words.length) return []
  return controls.filter((control) => words.every((word) => fold(control.label).includes(word)))
}

/** Where the pointer should go; the server tells the screens, and the app draws it. */
export const pointing = new EventEmitter<{ point: [{ x: number; y: number; label: string }] }>()

/** Pointing refers to pictures the model has just seen; an old one no longer shows what is there. */
const FRESH = 5 * 60_000

/**
 * A pixel in a picture, back to a place on the screen.
 *
 * Returns undefined when there is nothing recent to point into, or the pixel
 * falls outside the picture — both mean the model is guessing.
 */
export function placeOnScreen(screen: number, x: number, y: number): { x: number; y: number } | undefined {
  if (!lastLook || Date.now() - lastLook.at > FRESH) return undefined
  const shot = lastLook.screens.get(screen)
  if (!shot || x < 0 || y < 0 || x > shot.pixelWidth || y > shot.pixelHeight) return undefined
  return {
    x: Math.round(shot.frame.x + (x / shot.pixelWidth) * shot.frame.width),
    y: Math.round(shot.frame.y + (y / shot.pixelHeight) * shot.frame.height),
  }
}
