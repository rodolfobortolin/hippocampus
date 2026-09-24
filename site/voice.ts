/**
 * The sphere's voice on the page, and the sphere moving with what it says.
 * The tour and the greeting both talk through it.
 *
 * The lines are files generated once by scripts/site-voice.ts; the page calls
 * no API. They are fetched and decoded ahead of time and played from memory
 * through Web Audio. Swapping the src of an <audio> for each line, as this
 * did first, lost the start of every line on an iPhone: Safari began playing
 * before it had the first syllable, worse while the page was scrolling.
 *
 * A line that cannot be heard — no Web Audio, a missing file — still takes its
 * time at reading speed, so whatever waits on it neither hangs nor rushes, and
 * `heard` tells the caller to show the words instead.
 */

export type Stage = {
  /** Stop the sphere acting out its conversation, and hand its level to the voice. */
  pause(): void
  /** Give it back to its own act. */
  resume(): void
  speaking(on: boolean): void
  level(value: number): void
}

const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches

/** How long a line takes read silently: the fallback when it cannot be heard. */
export const readingTime = (text: string) => text.length * 55

// One context for the page: Safari allows only a handful, and each tour or
// greeting making its own ran out of them after a few clicks.
let shared: AudioContext | undefined

/**
 * Call it synchronously inside the click that starts a voice. iOS only lets
 * audio start from a gesture, and a context created or resumed after an
 * await — a dynamic import, a fetch — stays silent.
 */
export function unlockAudio() {
  try {
    // An iPhone on silent mutes Web Audio unless the page says it is playback,
    // the way a video is. Safari 16.4 and later.
    const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession
    if (session) session.type = 'playback'
    shared ??= new AudioContext()
    if (shared.state !== 'running') void shared.resume()
  } catch {
    shared = undefined
  }
  return shared
}

const buffers = new Map<string, Promise<AudioBuffer | null>>()

/** Fetches and decodes lines before they are needed, so none waits on the network. */
export function preload(ids: string[]) {
  const context = shared
  if (!context) return
  for (const id of ids) {
    if (buffers.has(id)) continue
    buffers.set(id, fetch(`voice/${id}.mp3`)
      .then((response) => (response.ok ? response.arrayBuffer() : Promise.reject(new Error(String(response.status)))))
      .then((data) => context.decodeAudioData(data))
      .catch(() => null))
  }
}

export function createVoice(stage: Stage) {
  const context = unlockAudio()
  let analyser: AnalyserNode | undefined
  let meter = 0
  if (context) {
    analyser = context.createAnalyser()
    analyser.fftSize = 512
    analyser.connect(context.destination)
    const samples = new Uint8Array(analyser.fftSize)
    const tick = () => {
      analyser!.getByteTimeDomainData(samples)
      let sum = 0
      for (const value of samples) sum += ((value - 128) / 128) ** 2
      // Held back, as the page's sphere is: at full level it blooms white.
      stage.level(still() ? 0 : Math.min(0.6, Math.sqrt(sum / samples.length) * 5))
      meter = requestAnimationFrame(tick)
    }
    tick()
  }

  let finish: (() => void) | null = null
  let closed = false

  /**
   * Says one line and resolves when it has been said. `started` gets the
   * line's length in milliseconds, and whether it is heard or only shown.
   */
  const say = async (id: string, text: string, started?: (ms: number, heard: boolean) => void) => {
    finish?.()
    preload([id])
    const buffer = context ? (await buffers.get(id)) ?? null : null
    // Bounded: where the browser has not allowed sound, resume() neither
    // resolves nor fails, and the line would wait on it for ever. The words
    // are shown instead.
    if (context && context.state !== 'running') {
      await Promise.race([context.resume().catch(() => {}), new Promise((resolve) => setTimeout(resolve, 400))])
    }
    // Closed while the line was still loading: say nothing.
    if (closed) return

    let source: AudioBufferSourceNode | null = null
    let fallback: ReturnType<typeof setTimeout> | undefined
    // Each line ends only itself: a line cut short fires its own `ended`
    // later, and that must not end the line that replaced it.
    let end!: () => void
    const ended = new Promise<void>((resolve) => {
      end = () => {
        if (finish === end) finish = null
        clearTimeout(fallback)
        try { source?.stop() } catch { /* already over */ }
        resolve()
      }
    })
    finish = end

    const heard = Boolean(buffer && context?.state === 'running' && analyser)
    let length = readingTime(text)
    if (heard) {
      source = context!.createBufferSource()
      source.buffer = buffer
      source.connect(analyser!)
      source.onended = end
      source.start()
      length = buffer!.duration * 1000
    } else {
      fallback = setTimeout(end, length)
    }
    stage.speaking(true)
    started?.(length, heard)
    await ended
    stage.speaking(false)
  }

  /** Silence now; a line cut short counts as said, so nothing waits on it forever. */
  const hush = () => finish?.()

  const close = () => {
    closed = true
    hush()
    cancelAnimationFrame(meter)
    analyser?.disconnect()
    stage.speaking(false)
    stage.level(0)
  }

  return { say, hush, close }
}
