/**
 * A screenshot, full screen, growing out of the picture that was clicked.
 *
 * It is one object, not two: the thumbnail hides while the large image flies
 * from exactly where the thumbnail sat, and on the way out it flies back into
 * the same place. Something that disappears one way is expected to come back
 * from where it went.
 *
 * - A click opens and closes with a strong ease-out: the movement starts at
 *   once, which is what makes a click feel answered. Closing is quicker than
 *   opening — the system responding, not the person deciding.
 * - The image can be dragged away. It follows the finger, the page behind
 *   brightens as it goes, and on release a flick is enough: the velocity is
 *   handed to a spring, so there is no seam between the hand and the motion.
 * - Nothing waits. Closing mid-opening starts from wherever the image is on
 *   screen, never from where it was meant to end up.
 * - The keyboard gets no animation at all — Enter, Escape and the arrows act
 *   instantly, as keyboard actions should.
 */

const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)'
const OPEN_MS = 440
const CLOSE_MS = 300
/** A flick faster than this, in px/ms, dismisses whatever the distance. */
const FLICK = 0.11
/** A drag this far dismisses even without a flick. */
const FAR = 140

type Pose = { x: number; y: number; s: number }
const IDENTITY: Pose = { x: 0, y: 0, s: 1 }
const css = (p: Pose) => `translate(${p.x}px, ${p.y}px) scale(${p.s})`

/**
 * A critically damped spring as a CSS `linear()` curve, for the moments a
 * gesture hands over its speed. `velocity` is in progress per second: the
 * release velocity divided by the distance left to travel. With no velocity
 * it starts gently; with a flick it starts at the flick's own speed.
 */
function spring(velocity: number, response = 0.36): { easing: string; duration: number } {
  const omega = (2 * Math.PI) / response
  // A hard flick may carry the image past its mark and back; it should not
  // carry it off the page.
  velocity = Math.max(-0.8 * omega, Math.min(0.8 * omega, velocity))
  const settle = Math.max(0.28, 9.2 / omega)
  const steps = 48
  const points: string[] = []
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * settle
    const progress = 1 - (1 + (omega - velocity) * t) * Math.exp(-omega * t)
    points.push(progress.toFixed(4))
  }
  points[steps] = '1'
  return { easing: `linear(${points.join(', ')})`, duration: settle * 1000 }
}
const springs = CSS.supports('animation-timing-function', 'linear(0, 1)')

/** A pose read off the screen: what the image looks like right now, mid-animation or not. */
function poseNow(el: HTMLElement): Pose {
  const matrix = getComputedStyle(el).transform
  if (!matrix || matrix === 'none') return { ...IDENTITY }
  const m = new DOMMatrixReadOnly(matrix)
  return { x: m.e, y: m.f, s: m.a }
}

export function setUpViewer(): void {
  const dialog = document.querySelector<HTMLDialogElement>('dialog.viewer')
  const links = [...document.querySelectorAll<HTMLAnchorElement>('a[data-zoom]')]
  if (!dialog || !links.length || typeof dialog.showModal !== 'function') return

  const image = dialog.querySelector<HTMLImageElement>('.viewer-image')!
  const scrim = dialog.querySelector<HTMLElement>('.viewer-scrim')!
  const caption = dialog.querySelector<HTMLElement>('.viewer-caption')!
  const closeButton = dialog.querySelector<HTMLButtonElement>('.viewer-close')!
  const prev = dialog.querySelector<HTMLButtonElement>('.viewer-step.prev')!
  const next = dialog.querySelector<HTMLButtonElement>('.viewer-step.next')!
  const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches

  const shots = links.map((link) => ({ link, img: link.querySelector('img')! }))
  let index = -1
  let closing = false
  let moving: Animation[] = []

  const stop = () => { for (const animation of moving) animation.cancel(); moving = [] }
  const play = (el: Element, frames: Keyframe[], options: KeyframeAnimationOptions) => {
    const animation = el.animate(frames, { fill: 'both', ...options })
    moving.push(animation)
    return animation
  }

  /** Where the image sits when nothing moves it — the frame every pose is measured from. */
  const rest = () => {
    const saved = image.style.transform
    image.style.transform = 'none'
    const box = image.getBoundingClientRect()
    image.style.transform = saved
    return box
  }
  /** The pose that lays the large image exactly over a thumbnail. */
  const poseOver = (thumb: DOMRect, box: DOMRect): Pose =>
    ({ x: thumb.left - box.left, y: thumb.top - box.top, s: thumb.width / box.width })
  const onScreen = (r: DOMRect) => r.width > 0 && r.bottom > 0 && r.top < innerHeight

  /** Settles the image at a pose after an animation, so cancelling it leaves nothing behind. */
  const hold = (pose: Pose) => { image.style.transform = pose === IDENTITY ? '' : css(pose) }

  function show(i: number) {
    shots[index]?.img.style.removeProperty('opacity')
    index = (i + shots.length) % shots.length
    const { img } = shots[index]
    image.src = img.currentSrc || img.src
    image.alt = img.alt
    caption.textContent = img.alt
  }

  async function open(i: number, animate: boolean) {
    stop()
    closing = false
    show(i)
    document.documentElement.classList.add('viewing')
    dialog!.showModal()
    // The thumbnail may still be lazy; the size must be known before the flight.
    await image.decode().catch(() => {})
    const thumb = shots[index].img
    const from = thumb.getBoundingClientRect()

    if (!animate || still() || !onScreen(from)) {
      hold(IDENTITY)
      if (animate) {
        play(scrim, [{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'ease' })
        play(image, [{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'ease' })
      }
      return
    }

    // One object: the thumbnail steps aside while its larger self takes off.
    thumb.style.opacity = '0'
    dialog!.classList.add('settling')
    const start = poseOver(from, rest())
    play(image, [{ transform: css(start) }, { transform: css(IDENTITY) }], { duration: OPEN_MS, easing: EASE_OUT })
    play(scrim, [{ opacity: 0 }, { opacity: 1 }], { duration: OPEN_MS * 0.8, easing: EASE_OUT })
    setTimeout(() => dialog!.classList.remove('settling'), OPEN_MS * 0.55)
  }

  /**
   * Back into the thumbnail. `velocity` (px/ms along y) comes from a drag and
   * turns the flight into a spring that starts at the finger's speed.
   */
  function close(animate: boolean, velocity = 0) {
    if (closing || !dialog!.open) return
    const thumb = shots[index].img
    const to = thumb.getBoundingClientRect()
    const from = poseNow(image)
    const fromScrim = Number(getComputedStyle(scrim).opacity)
    stop()

    const finish = () => {
      stop()
      image.style.transform = ''
      thumb.style.removeProperty('opacity')
      dialog!.classList.remove('settling')
      dialog!.close()
      document.documentElement.classList.remove('viewing')
      shots[index].link.focus({ preventScroll: true })
      closing = false
    }
    if (!animate) return finish()

    closing = true
    dialog!.classList.add('settling')
    if (still() || !onScreen(to)) {
      // Its place is off screen, or motion is unwelcome: it fades where it is.
      play(image, [{ opacity: 1, transform: css(from) }, { opacity: 0, transform: css(from) }], { duration: 200, easing: 'ease' })
      play(scrim, [{ opacity: fromScrim }, { opacity: 0 }], { duration: 200, easing: 'ease' }).finished.then(finish, () => {})
      return
    }

    const target = poseOver(to, rest())
    const distance = target.y - from.y
    const timing = velocity && springs && Math.abs(distance) > 1
      ? spring((velocity * 1000) / distance)
      : { easing: EASE_OUT, duration: CLOSE_MS }
    thumb.style.opacity = '0'
    play(image, [{ transform: css(from) }, { transform: css(target) }], timing)
    play(scrim, [{ opacity: fromScrim }, { opacity: 0 }], { duration: Math.min(timing.duration, CLOSE_MS), easing: EASE_OUT })
      .finished.then(() => setTimeout(finish, Math.max(0, timing.duration - CLOSE_MS)), () => {})
  }

  /** Next or previous. From a pointer, a short cross-fade softened by a blur; from the keyboard, instantly. */
  function step(delta: number, animate: boolean) {
    if (closing) return
    if (!animate || still()) { show(index + delta); shots[index].img.style.opacity = '0'; return }
    stop()
    hold(IDENTITY)
    play(image, [{ opacity: 1, filter: 'blur(0px)' }, { opacity: 0, filter: 'blur(4px)' }], { duration: 110, easing: 'ease' })
      .finished.then(async () => {
        show(index + delta)
        shots[index].img.style.opacity = '0'
        await image.decode().catch(() => {})
        stop()
        play(image, [{ opacity: 0, filter: 'blur(4px)' }, { opacity: 1, filter: 'blur(0px)' }], { duration: 180, easing: 'ease' })
      }, () => {})
  }

  for (const [i, { link }] of shots.entries()) {
    link.addEventListener('click', (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey) return // a new tab is still a new tab
      event.preventDefault()
      // `detail` is 0 when Enter or Space activated the link.
      void open(i, event.detail !== 0)
    })
  }
  closeButton.addEventListener('click', (event) => close(event.detail !== 0))
  scrim.addEventListener('click', () => close(true))
  prev.addEventListener('click', (event) => step(-1, event.detail !== 0))
  next.addEventListener('click', (event) => step(1, event.detail !== 0))
  dialog.addEventListener('cancel', (event) => { event.preventDefault(); close(false) })
  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowRight') step(1, false)
    if (event.key === 'ArrowLeft') step(-1, false)
  })

  // ---------- dragging it away ----------
  let drag: { id: number; x: number; y: number; moved: boolean; base: Pose; box: DOMRect; trail: { y: number; t: number }[] } | null = null

  image.addEventListener('pointerdown', (event) => {
    if (drag || closing || event.button !== 0) return // one finger at a time
    // Grabbed mid-flight, it stays exactly where it is on screen.
    const base = poseNow(image)
    stop()
    hold(base)
    image.setPointerCapture(event.pointerId)
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false, base, box: rest(), trail: [{ y: event.clientY, t: event.timeStamp }] }
  })

  image.addEventListener('pointermove', (event) => {
    if (!drag || event.pointerId !== drag.id) return
    const dx = event.clientX - drag.x
    const dy = event.clientY - drag.y
    if (!drag.moved && Math.hypot(dx, dy) < 6) return
    drag.moved = true
    // It shrinks a little as it leaves, around its own centre, and the page
    // behind comes back in proportion.
    const s = drag.base.s * (1 - Math.min(Math.abs(dy) / 1800, 0.22))
    const x = drag.base.x + dx + ((drag.base.s - s) * drag.box.width) / 2
    const y = drag.base.y + dy + ((drag.base.s - s) * drag.box.height) / 2
    image.style.transform = css({ x, y, s })
    scrim.style.opacity = String(Math.max(0.15, 1 - Math.abs(dy) / 420))
    drag.trail.push({ y: event.clientY, t: event.timeStamp })
    while (drag.trail.length > 2 && event.timeStamp - drag.trail[0].t > 100) drag.trail.shift()
  })

  const release = (event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.id) return
    const { moved, trail } = drag
    const dy = event.clientY - drag.y
    drag = null
    scrim.style.removeProperty('opacity')
    if (!moved) { close(true); return } // a plain click on the picture closes it

    const first = trail[0]
    const last = trail[trail.length - 1]
    const velocity = last.t > first.t ? (last.y - first.y) / (last.t - first.t) : 0
    // Direction comes from the velocity's sign, not only the distance: a
    // drag pulled back toward the centre is a change of mind.
    const toward = Math.sign(velocity) === Math.sign(dy)
    const dismiss = (Math.abs(velocity) > FLICK && toward) || (Math.abs(dy) > FAR && (toward || Math.abs(velocity) < 0.05))
    if (dismiss) { close(true, velocity); return }

    // Back to the centre, carrying the speed it was released with.
    const from = poseNow(image)
    const scrimFrom = Number(getComputedStyle(scrim).opacity)
    const timing = springs && Math.abs(from.y) > 1 ? spring((-velocity * 1000) / from.y) : { easing: EASE_OUT, duration: 260 }
    stop()
    play(image, [{ transform: css(from) }, { transform: css(IDENTITY) }], timing)
      .finished.then(() => { stop(); hold(IDENTITY) }, () => {})
    play(scrim, [{ opacity: scrimFrom }, { opacity: 1 }], { duration: 220, easing: EASE_OUT })
  }
  image.addEventListener('pointerup', release)
  image.addEventListener('pointercancel', release)
  // A click on the image is handled by pointerup; the native one must not
  // reach the scrim underneath.
  image.addEventListener('click', (event) => event.stopPropagation())
}
