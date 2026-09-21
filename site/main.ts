import { Core, type CoreState } from '../src/three/Core.ts'
import { setUpMotion } from './motion.ts'
import { setUpViewer } from './viewer.ts'

setUpMotion()
setUpViewer()

/**
 * The sphere at the top of the page is the one from the app, running the same
 * shader. Here nobody is talking to it, so it acts out a conversation on its
 * own: it rests, hears someone, thinks, and answers — with a voice level made
 * up to look like speech, since there is no real voice to follow.
 *
 * A click makes it listen, the way it does in the app, so the page answers
 * the first thing a curious visitor does.
 */

const canvas = document.getElementById('core') as HTMLCanvasElement | null
const caption = document.getElementById('core-state')
const still = matchMedia('(prefers-reduced-motion: reduce)').matches

if (canvas) {
  const core = new Core(canvas, { compact: false, dust: true })
  new ResizeObserver(() => core.resize()).observe(canvas)

  const WORDS: Record<CoreState, string> = {
    idle: 'click to speak',
    listening: 'listening…',
    thinking: 'looking it up…',
    tool: 'reading the day…',
    speaking: 'you spent most of the afternoon in harbor',
    error: '',
  }

  let state: CoreState = 'idle'
  const show = (next: CoreState) => {
    state = next
    core.setState(next)
    if (caption) caption.textContent = WORDS[next]
  }

  // Speech is bursts with gaps, not a steady tone: two sines at unrelated
  // rates, clipped at zero, read like syllables.
  let started = performance.now()
  const voice = () => {
    const t = (performance.now() - started) / 1000
    const level = state === 'speaking' ? Math.max(0, Math.sin(t * 7.3) * 0.6 + Math.sin(t * 2.1) * 0.5)
      : state === 'listening' ? Math.max(0, Math.sin(t * 5.1) * 0.35 + Math.sin(t * 1.7) * 0.3)
      : 0
    core.setLevel(level)
    requestAnimationFrame(voice)
  }

  // Rest → someone speaks → it looks it up → it answers → rest again.
  const SCRIPT: [CoreState, number][] = [
    ['idle', 3200], ['listening', 2600], ['thinking', 1400], ['tool', 1600], ['speaking', 3800],
  ]
  let step = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  const next = () => {
    const [name, ms] = SCRIPT[step % SCRIPT.length]
    show(name)
    started = performance.now()
    step++
    timer = setTimeout(next, ms)
  }

  if (still) {
    show('idle')
  } else {
    requestAnimationFrame(voice)
    next()
  }

  // A click is someone wanting to talk to it.
  const orb = canvas.closest('.orb') as HTMLElement | null
  orb?.setAttribute('tabindex', '0')
  orb?.setAttribute('role', 'button')
  const listen = () => {
    clearTimeout(timer)
    core.pulse()
    show('listening')
    started = performance.now()
    step = 2
    timer = setTimeout(next, 2800)
  }
  orb?.addEventListener('click', listen)
  orb?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); listen() }
  })
}
