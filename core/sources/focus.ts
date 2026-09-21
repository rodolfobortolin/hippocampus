import { spawn, type ChildProcess } from 'node:child_process'
import { config, paths, dayOf } from '../config.ts'
import { db } from '../db.ts'
import { isSecret } from '../privacy.ts'
import { exists } from '../guard.ts'

type Sample = {
  ts: string
  idle: number
  locked: boolean
  trusted: boolean
  /** Counters accumulated since boot; what counts is the delta between samples. */
  keys?: number
  clicks?: number
  scroll?: number
  mic?: boolean
  /** Some camera is on, in any app — read without camera permission. */
  camera?: boolean
  /** Some audio output is playing. */
  sound?: boolean
  /** The wake-word listener is on (and therefore holding the microphone). */
  listening?: boolean
  /** A media app is open — a weak hint: open is not playing. */
  mediaOpen?: string
  /** What is playing, when the player can be asked or the tab can be found. */
  playing?: string
  /** The name of the screen the focused window is on. */
  screen?: string
  app?: string
  bundle?: string
  title?: string
  url?: string
}

type Open = { id: number; key: string; startedAt: number; endedAt: number }
type Counters = { keys: number; clicks: number; scroll: number }

// The column list and the value list have to move together. When `screen`,
// `sound`, `media` and `playing` were born, only the values were added — and
// the node:sqlite of the day swallowed the extra parameters silently, so 887
// blocks were written with the four fields empty and nobody noticed. A newer
// version refuses with "column index out of range", which is the right call.
const insert = db.prepare(
  `insert into blocks (started_at, ended_at, seconds, day, app, bundle, title, url, host, idle,
                       keys, clicks, scroll, mic, camera, screen, sound, media, playing)
   values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
)

// Inside one block the track changes, the call starts and the sound stops. So
// accumulated state uses `max` and the value of the moment uses
// `coalesce(?, column)`: a new value wins, a null leaves what was there. The
// `coalesce` around `mic` and `sound` is needed because `max` with NULL
// returns NULL — that is how `sound` stayed forever empty even while the
// helper reported that something was playing.
const extend = db.prepare(
  `update blocks set ended_at = ?, seconds = ?,
          keys = keys + ?, clicks = clicks + ?, scroll = scroll + ?,
          mic = max(coalesce(mic, 0), ?), camera = max(coalesce(camera, 0), ?), sound = max(coalesce(sound, 0), ?),
          media = coalesce(?, media), playing = coalesce(?, playing)
     where id = ?`,
)

function hostOf(url?: string): string | null {
  if (!url) return null
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

/**
 * Reads the native helper and turns samples into continuous blocks.
 * A block is written the moment it starts and extended on every sample, so a
 * collector crash costs at most one sample.
 */
export class FocusCollector {
  private child: ChildProcess | null = null
  /** True when samples arrive from outside, pushed by the helper. */
  pushed = false
  private open: Open | null = null
  private buffer = ''
  private previous: Counters | null = null
  private onTrust?: (trusted: boolean) => void
  lastSample: Sample | null = null
  /**
   * Whether the helper holds Accessibility — `null` until it has said.
   *
   * Starting at `false` is not "we do not have it", it is "we have not been
   * told yet", and the screen cannot tell those apart: it put up a warning
   * about a missing permission every time the app opened, then took it back
   * fifteen seconds later when the first sample arrived. A warning that
   * retracts itself teaches people to ignore warnings.
   */
  trusted: boolean | null = null

  constructor(options: { onTrust?: (trusted: boolean) => void } = {}) {
    this.onTrust = options.onTrust
  }

  /**
   * Takes a sample pushed by the helper that launchd started.
   *
   * This is the preferred path: the helper answers for itself in the TCC, so
   * the Accessibility grant belongs to it rather than to node.
   */
  push(sample: unknown): void {
    this.pushed = true
    try {
      this.ingest(sample as Sample)
    } catch (error) {
      // With the message alone, a SQL error becomes a line that does not say
      // which query failed — that is how an insert with one parameter too many
      // stayed invisible for months. The stack says.
      console.error('[focus] invalid sample:', (error as Error).stack ?? error)
    }
  }

  async start(): Promise<void> {
    // Async because the helper can live in `~/Documents`, which macOS
    // protects: `existsSync` there does not error, it freezes the collector.
    if (!(await exists(paths.native))) {
      console.error('[focus] helper nativo ausente — rode `npm run build:native`')
      return
    }
    this.child = spawn(paths.native, ['--interval', String(config.sampleInterval)], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    this.child.stdout?.on('data', (chunk) => this.consume(String(chunk)))
    this.child.stderr?.on('data', (chunk) => console.error('[focus]', String(chunk).trim()))
    this.child.on('exit', (code) => {
      console.error(`[focus] helper saiu (${code}); tentando de novo em 5s`)
      this.child = null
      this.open = null
      setTimeout(() => void this.start(), 5000)
    })
  }

  stop(): void {
    this.child?.kill()
    this.child = null
    this.open = null
  }

  private consume(chunk: string): void {
    this.buffer += chunk
    const lines = this.buffer.split('\n')
    this.buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.trim()) continue
      try {
        this.ingest(JSON.parse(line) as Sample)
      } catch {
        /* a partial or invalid line — ignore it */
      }
    }
  }

  private ingest(sample: Sample): void {
    this.lastSample = sample
    if (sample.trusted !== this.trusted) {
      this.trusted = sample.trusted
      this.onTrust?.(sample.trusted)
    }

    const ts = Math.floor(new Date(sample.ts).getTime() / 1000)

    // The counters accumulate since boot: what matters is how far they moved
    // since the previous sample. A reboot resets them and the delta comes out
    // negative — then the sample is skipped rather than becoming an absurd number.
    const now: Counters = {
      keys: sample.keys ?? 0, clicks: sample.clicks ?? 0, scroll: sample.scroll ?? 0,
    }
    const raw = this.previous
      ? {
          keys: now.keys - this.previous.keys,
          clicks: now.clicks - this.previous.clicks,
          scroll: now.scroll - this.previous.scroll,
        }
      : { keys: 0, clicks: 0, scroll: 0 }
    const delta = Object.values(raw).some((v) => v < 0) ? { keys: 0, clicks: 0, scroll: 0 } : raw
    this.previous = now
    // Our own listening does not count as a call.
    const mic = sample.mic && !sample.listening ? 1 : 0
    const idle = sample.locked || sample.idle >= config.idleThreshold
    const app = idle ? (sample.locked ? 'Tela bloqueada' : 'Ocioso') : sample.app ?? 'Desconhecido'
    // O tempo num gerenciador de senha ou no banco continua contando; o que
    // was written in the title bar does not.
    const secret = !idle && isSecret(sample.app, sample.title, sample.url)
    const title = idle || secret ? null : sample.title ?? null
    const key = `${idle ? 'idle' : 'live'}|${app}|${title ?? ''}|${sample.screen ?? ''}|${sample.playing ?? ''}`

    // Buraco grande (sono, coletor parado) close o block openedAt.
    const gap = this.open ? ts - this.open.endedAt : 0
    if (this.open && (this.open.key !== key || gap > config.sampleInterval * 4)) this.open = null

    if (this.open) {
      this.open.endedAt = ts
      extend.run(ts, ts - this.open.startedAt, delta.keys, delta.clicks, delta.scroll,
        mic, sample.camera ? 1 : 0, sample.sound ? 1 : 0,
        sample.listening ? null : sample.mediaOpen ?? null, sample.playing ?? null,
        this.open.id)
      return
    }

    const url = idle || secret ? null : sample.url ?? null
    const result = insert.run(
      ts, ts, 0, dayOf(ts), app, idle ? null : sample.bundle ?? null,
      title, url, hostOf(url ?? undefined), idle ? 1 : 0,
      delta.keys, delta.clicks, delta.scroll, mic, sample.camera ? 1 : 0, idle ? null : sample.screen ?? null,
      sample.sound ? 1 : 0,
      // With the listener on, the microphone is always open because of us;
      // marking a call in that state would invent a meeting every day.
      sample.listening ? null : sample.mediaOpen ?? null, sample.playing ?? null,
    )
    this.open = { id: Number(result.lastInsertRowid), key, startedAt: ts, endedAt: ts }
  }
}
