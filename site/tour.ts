import { TOUR, type TourPoint, type TourStep } from './tour-script.ts'
import { createVoice, type Stage } from './voice.ts'

export type { Stage }

/**
 * "Show me": the app showing itself.
 *
 * The sphere leaves the hero for the bottom corner — where the app's floating
 * core lives — and talks through the page in the app's own voice, while a
 * spark of it flies to what is being said, the way the app points at your
 * screen. The page scrolls under it, one part at a time.
 *
 * It stops the moment you ask: the ×, a click on the sphere, or Escape, and
 * the sphere goes back where it came from. With reduced motion there is no
 * flying and no smooth scrolling: the spark appears where it points.
 */

const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)'
const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

let running: { stop: () => void } | null = null

export function tourRunning() { return running !== null }
export function stopTour() { running?.stop() }

/**
 * `opening` replaces the first line: after the sphere has already said hello
 * and been answered yes, introducing itself again sounds like it forgot.
 */
export async function startTour(stage: Stage, { opening }: { opening?: TourStep } = {}) {
  if (running) return
  const orb = document.querySelector<HTMLElement>('.orb')
  if (!orb) return
  let stopped = false
  const cleanups: (() => void)[] = []

  // ---------- the dock: the sphere in the corner, a caption beside it ----------
  const home = orb.parentElement!
  const marker = document.createComment('orb home')
  home.insertBefore(marker, orb)
  const dock = document.createElement('div')
  dock.className = 'dock'
  dock.innerHTML = `
    <p class="dock-caption" aria-live="polite"></p>
    <button class="dock-close" type="button" aria-label="Stop the tour">
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
    </button>`
  document.body.append(dock)
  const captionEl = dock.querySelector<HTMLElement>('.dock-caption')!

  /** One object, not two: the sphere flies from where it was to where it goes. */
  const move = (into: Element, before: Node | null) => {
    const from = orb.getBoundingClientRect()
    into.insertBefore(orb, before)
    const to = orb.getBoundingClientRect()
    if (still() || !from.width || !to.width) return
    const dx = from.left + from.width / 2 - (to.left + to.width / 2)
    const dy = from.top + from.height / 2 - (to.top + to.height / 2)
    orb.animate(
      [{ transform: `translate(${dx}px, ${dy}px) scale(${from.width / to.width})` }, { transform: 'none' }],
      { duration: 700, easing: EASE_OUT },
    )
  }
  move(dock, dock.firstChild)
  document.documentElement.classList.add('touring')
  stage.pause()

  // ---------- the spark ----------
  const spark = document.createElement('div')
  spark.className = 'tour-spark'
  spark.innerHTML = '<i></i><span></span>'
  document.body.append(spark)
  const sparkLabel = spark.querySelector('span')!
  let at = { x: innerWidth - 90, y: innerHeight - 110 }
  const place = (x: number, y: number) => { spark.style.transform = `translate(${x}px, ${y}px)` }
  place(at.x, at.y)

  let flight = 0
  /** Along an arc, not a line: a straight line reads as a jump. */
  const fly = (to: { x: number; y: number }, label: string) => {
    cancelAnimationFrame(flight)
    sparkLabel.textContent = label
    spark.classList.add('on')
    const from = at
    at = to
    if (still()) return place(to.x, to.y)
    const dx = to.x - from.x
    const dy = to.y - from.y
    const lift = Math.min(160, Math.hypot(dx, dy) * 0.3)
    const control = { x: from.x + dx / 2, y: from.y + dy / 2 - lift }
    const duration = Math.min(900, Math.max(420, Math.hypot(dx, dy) * 0.8))
    const start = performance.now()
    const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
    const frame = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const e = ease(t)
      const u = 1 - e
      place(u * u * from.x + 2 * u * e * control.x + e * e * to.x, u * u * from.y + 2 * u * e * control.y + e * e * to.y)
      if (t < 1) flight = requestAnimationFrame(frame)
    }
    flight = requestAnimationFrame(frame)
  }

  const where = (point: TourPoint) => {
    const element = document.querySelector(point.target)
    if (!element) return null
    const box = element.getBoundingClientRect()
    return { x: box.left + box.width * (point.x ?? 0.5), y: box.top + box.height * (point.y ?? 0.5) }
  }

  const scrollTo = async (selector: string) => {
    const element = document.querySelector(selector)
    if (!element) return
    const box = element.getBoundingClientRect()
    // Its middle a little above the screen's, so the dock does not cover it.
    const top = window.scrollY + box.top + box.height / 2 - innerHeight * 0.44
    window.scrollTo({ top: Math.max(0, top), behavior: still() ? 'auto' : 'smooth' })
    await new Promise<void>((resolve) => {
      const done = () => { removeEventListener('scrollend', done); resolve() }
      addEventListener('scrollend', done, { once: true })
      setTimeout(done, still() ? 50 : 1100)
    })
  }

  // ---------- the voice, and the sphere moving with it ----------
  const voice = createVoice(stage)

  const stop = () => {
    if (stopped) return
    stopped = true
    running = null
    voice.close()
    cancelAnimationFrame(flight)
    for (const cleanup of cleanups) cleanup()
    spark.remove()
    move(home, marker)
    marker.remove()
    dock.remove()
    document.documentElement.classList.remove('touring')
    stage.resume()
  }
  running = { stop }

  const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') stop() }
  addEventListener('keydown', onKey)
  cleanups.push(() => removeEventListener('keydown', onKey))
  dock.querySelector('.dock-close')!.addEventListener('click', stop)
  // A click on the sphere while it talks is someone asking it to stop.
  const onOrb = (event: Event) => { event.stopImmediatePropagation(); stop() }
  orb.addEventListener('click', onOrb, { capture: true })
  cleanups.push(() => orb.removeEventListener('click', onOrb, { capture: true }))

  // ---------- the script ----------
  const script = opening ? [opening, ...TOUR.slice(1)] : TOUR
  for (const step of script) {
    if (stopped) return
    // Out of sight while the page moves: left where it was, it ended up on
    // top of whatever scrolled under it.
    spark.classList.remove('on')
    await scrollTo(step.scroll)
    if (stopped) return
    captionEl.textContent = step.text
    const timers: ReturnType<typeof setTimeout>[] = []
    await voice.say(step.id, step.text, (length) => {
      for (const point of step.points) {
        timers.push(setTimeout(() => {
          const spot = where(point)
          if (spot && !stopped) fly(spot, point.label)
        }, point.at * length))
      }
    })
    for (const timer of timers) clearTimeout(timer)
    if (stopped) return
    await wait(350)
  }
  if (stopped) return
  await wait(900)
  stop()
}
