/**
 * The sphere's voice on the page: one audio element, and the sphere moving
 * with what it plays. The tour and the greeting both talk through it.
 *
 * The lines are files generated once by scripts/site-voice.ts; the page calls
 * no API. A line that cannot play — blocked, missing — still takes its time
 * at reading speed, so whatever waits on it does not hang or rush.
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

export function createVoice(stage: Stage) {
  const audio = new Audio()
  audio.preload = 'auto'
  let context: AudioContext | undefined
  let meter = 0
  try {
    context = new AudioContext()
    const analyser = context.createAnalyser()
    analyser.fftSize = 512
    context.createMediaElementSource(audio).connect(analyser)
    analyser.connect(context.destination)
    const buffer = new Uint8Array(analyser.fftSize)
    const tick = () => {
      analyser.getByteTimeDomainData(buffer)
      let sum = 0
      for (const value of buffer) sum += ((value - 128) / 128) ** 2
      // Held back, as the page's sphere is: at full level it blooms white.
      stage.level(still() ? 0 : Math.min(0.6, Math.sqrt(sum / buffer.length) * 5))
      meter = requestAnimationFrame(tick)
    }
    tick()
  } catch {
    // Without Web Audio the voice still plays; the sphere just does not move with it.
  }

  let finish: (() => void) | null = null

  /**
   * Says one line and resolves when it has been said. `started` gets the
   * line's length in milliseconds once it is known, for anything timed to it.
   */
  const say = async (id: string, text: string, started?: (ms: number) => void) => {
    finish?.()
    audio.src = `voice/${id}.mp3`
    let fallback: ReturnType<typeof setTimeout> | undefined
    const ended = new Promise<void>((resolve) => {
      finish = () => { clearTimeout(fallback); finish = null; resolve() }
      audio.onended = () => finish?.()
      audio.onerror = () => { fallback = setTimeout(() => finish?.(), readingTime(text)) }
    })
    try {
      await audio.play()
    } catch {
      // Blocked or missing: the caption carries the line alone, at reading speed.
      fallback = setTimeout(() => finish?.(), readingTime(text))
    }
    stage.speaking(true)
    started?.(Number.isFinite(audio.duration) ? audio.duration * 1000 : readingTime(text))
    await ended
    stage.speaking(false)
  }

  /** Silence now; a line cut short counts as said, so nothing waits on it forever. */
  const hush = () => {
    audio.pause()
    finish?.()
  }

  const close = () => {
    hush()
    cancelAnimationFrame(meter)
    void context?.close()
    stage.speaking(false)
    stage.level(0)
  }

  return { say, hush, close }
}
