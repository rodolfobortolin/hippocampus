/**
 * The page's motion, apart from the sphere and the viewer.
 *
 * Everything here happens once, on the way down, or on its own while in
 * view. The states it reveals from are gated behind the `js` class set in the
 * page's head, so without this script nothing is left hidden.
 */

const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches

/** Sections rise into place the first time they come into view. */
function reveals(): void {
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue
      entry.target.classList.add('in')
      io.unobserve(entry.target)
    }
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 })
  for (const el of document.querySelectorAll('.reveal')) io.observe(el)
}

/** The bar turns into frosted glass once the page runs underneath it. */
function frostedBar(): void {
  const bar = document.querySelector('.top')
  if (!bar) return
  const update = () => bar.classList.toggle('scrolled', window.scrollY > 8)
  update()
  addEventListener('scroll', update, { passive: true })
}

/**
 * Three traces of one ticket gathering into one line. It plays each time it
 * comes back into view — it explains something, and someone scrolling back
 * up to it is usually looking again.
 */
function merge(): void {
  const el = document.querySelector<HTMLElement>('[data-merge]')
  if (!el) return
  new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return
    el.classList.remove('play')
    void el.offsetWidth // restart the animation from its first frame
    el.classList.add('play')
  }, { threshold: 0.7 }).observe(el)
}

const SVG = 'http://www.w3.org/2000/svg'

/**
 * The wires of the flow, drawn from where the boxes actually are, so the same
 * drawing works as three columns and as a stack. Light travels along them at
 * a constant pace — linear, since it never starts or stops — and only while
 * the drawing is on screen.
 */
function flow(): void {
  const root = document.querySelector<HTMLElement>('[data-flow]')
  if (!root) return
  const svg = root.querySelector<SVGSVGElement>('svg.wires')!
  const core = root.querySelector<HTMLElement>('.core')!
  const sources = [...root.querySelectorAll<HTMLElement>('.sources li')]
  const outputs = [...root.querySelectorAll<HTMLElement>('.outputs li')]
  const services = [...root.querySelectorAll<HTMLElement>('.services li')]
  sources.forEach((li, k) => li.style.setProperty('--k', String(k)))
  outputs.forEach((li, k) => li.style.setProperty('--k', String(k)))
  services.forEach((li, k) => li.style.setProperty('--k', String(k)))

  let shown = false
  let live = false

  const draw = () => {
    const box = root.getBoundingClientRect()
    const c = core.getBoundingClientRect()
    const at = (x: number, y: number) => [x - box.left, y - box.top] as const
    // Stacked when the core sits below the last source, as on a phone.
    const stacked = c.top >= sources[sources.length - 1].getBoundingClientRect().bottom - 2
    svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`)
    svg.replaceChildren()

    const wire = (from: readonly [number, number], to: readonly [number, number], colour: string, delay: number,
      vertical = stacked) => {
      const [fx, fy] = from
      const [tx, ty] = to
      const d = vertical
        ? `M${fx},${fy} C${fx},${(fy + ty) / 2} ${tx},${(fy + ty) / 2} ${tx},${ty}`
        : `M${fx},${fy} C${(fx + tx) / 2},${fy} ${(fx + tx) / 2},${ty} ${tx},${ty}`
      const path = document.createElementNS(SVG, 'path')
      path.setAttribute('d', d)
      path.setAttribute('pathLength', '1')
      path.style.setProperty('--c', colour)
      path.style.setProperty('--d', `${delay}ms`)
      svg.append(path)
      return d
    }

    const spread = (k: number, n: number, size: number) => (k - (n - 1) / 2) * Math.min(12, size / (n + 1))
    const lines: { d: string; colour: string; outbound: boolean; k: number; away?: boolean }[] = []
    sources.forEach((li, k) => {
      const r = li.getBoundingClientRect()
      const colour = getComputedStyle(li).getPropertyValue('--c').trim() || '#ffffff'
      const from = stacked ? at(r.left + r.width / 2, r.bottom) : at(r.right, r.top + r.height / 2)
      const to = stacked
        ? at(c.left + c.width / 2 + spread(k, sources.length, c.width), c.top)
        : at(c.left, c.top + c.height / 2 + spread(k, sources.length, c.height))
      lines.push({ d: wire(from, to, colour, 200 + k * 60), colour, outbound: false, k })
    })
    outputs.forEach((li, k) => {
      const r = li.getBoundingClientRect()
      const colour = '#ff8a3d'
      const from = stacked
        ? at(c.left + c.width / 2 + spread(k, outputs.length, c.width), c.bottom)
        : at(c.right, c.top + c.height / 2 + spread(k, outputs.length, c.height))
      const to = stacked ? at(r.left + r.width / 2, r.top) : at(r.left, r.top + r.height / 2)
      lines.push({ d: wire(from, to, colour, 750 + k * 60), colour, outbound: true, k })
    })
    // Out of the Mac and back: from the core's foot, across the frame's edge,
    // to each service. Not drawn when the drawing stands up, as on a phone —
    // the outputs sit between the core and the services there, and a wire
    // would run straight through them.
    if (!stacked) services.forEach((li, k) => {
      const r = li.getBoundingClientRect()
      const colour = getComputedStyle(li).getPropertyValue('--c').trim() || '#ffffff'
      const from = at(c.left + c.width / 2 + (k - (services.length - 1) / 2) * 28, c.bottom)
      const to = at(r.left + r.width / 2, r.top)
      lines.push({ d: wire(from, to, colour, 1300 + k * 90, true), colour, outbound: false, k, away: true })
    })

    // The light, only once the wires exist and only if motion is welcome.
    if (still()) return
    const now = svg.getCurrentTime()
    for (const { d, colour, outbound, k, away } of lines) {
      if (away) {
        for (const back of [false, true]) {
          const dot = document.createElementNS(SVG, 'circle')
          dot.setAttribute('r', '2.6')
          dot.setAttribute('fill', back ? '#ff8a3d' : colour)
          dot.setAttribute('opacity', '0')
          dot.style.color = back ? '#ff8a3d' : colour
          const duration = 2.4
          const begin = now + (shown ? 0 : 1.6) + 2 + k * 0.6 + (back ? duration / 2 : 0)
          const motion = document.createElementNS(SVG, 'animateMotion')
          motion.setAttribute('path', d)
          motion.setAttribute('dur', `${duration}s`)
          motion.setAttribute('begin', `${begin}s`)
          motion.setAttribute('repeatCount', 'indefinite')
          // What comes back travels the same wire the other way.
          if (back) {
            motion.setAttribute('keyPoints', '1;0')
            motion.setAttribute('keyTimes', '0;1')
            motion.setAttribute('calcMode', 'linear')
          }
          const fade = document.createElementNS(SVG, 'animate')
          fade.setAttribute('attributeName', 'opacity')
          fade.setAttribute('values', '0;1;1;0')
          fade.setAttribute('keyTimes', '0;0.12;0.85;1')
          fade.setAttribute('dur', `${duration}s`)
          fade.setAttribute('begin', `${begin}s`)
          fade.setAttribute('repeatCount', 'indefinite')
          dot.append(motion, fade)
          svg.append(dot)
        }
        continue
      }
      const dot = document.createElementNS(SVG, 'circle')
      dot.setAttribute('r', outbound ? '2.8' : '2.4')
      dot.setAttribute('fill', colour)
      dot.setAttribute('opacity', '0')
      dot.style.color = colour
      // Sources send at their own rhythm; what comes out follows the core.
      const duration = outbound ? 2.2 : 2.6 + (k % 3) * 0.35
      const begin = now + (shown ? 0 : 1.6) + (outbound ? 1.3 + k * 0.45 : k * 0.37)
      const motion = document.createElementNS(SVG, 'animateMotion')
      motion.setAttribute('path', d)
      motion.setAttribute('dur', `${duration}s`)
      motion.setAttribute('begin', `${begin}s`)
      motion.setAttribute('repeatCount', 'indefinite')
      const fade = document.createElementNS(SVG, 'animate')
      fade.setAttribute('attributeName', 'opacity')
      fade.setAttribute('values', '0;1;1;0')
      fade.setAttribute('keyTimes', '0;0.12;0.85;1')
      fade.setAttribute('dur', `${duration}s`)
      fade.setAttribute('begin', `${begin}s`)
      fade.setAttribute('repeatCount', 'indefinite')
      dot.append(motion, fade)
      svg.append(dot)
    }
  }

  draw()
  let pending = 0
  new ResizeObserver(() => {
    cancelAnimationFrame(pending)
    pending = requestAnimationFrame(draw)
  }).observe(root)

  new IntersectionObserver(([entry]) => {
    live = entry.isIntersecting
    if (live && !shown) { shown = true; root.classList.add('in') }
    if (live) svg.unpauseAnimations()
    else svg.pauseAnimations()
  }, { threshold: 0.2 }).observe(root)
  if (!live) svg.pauseAnimations()
}

export function setUpMotion(): void {
  frostedBar()
  reveals()
  merge()
  flow()
}
