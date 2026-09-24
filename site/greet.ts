import { GREETING } from './tour-script.ts'
import { createVoice, type Stage } from './voice.ts'

/**
 * A click on the sphere: it says hello and offers to show you around. The
 * answer is two buttons under it, so nobody has to talk back to a web page.
 * Yes starts the tour; not now gets a short "I'll be here", and the sphere
 * goes back to its own act.
 *
 * While it asks, the sphere stops being a button: a button that holds other
 * buttons hides them from screen readers, and its Enter would swallow theirs.
 */

const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)'
const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches

let open: { dismiss: () => void } | null = null

export function greeting() { return open !== null }
/** Closes it without a word, as when "Show me" is pressed while it asks. */
export function dismissGreeting() { open?.dismiss() }

export function greet(stage: Stage, orb: HTMLElement, onYes: () => void) {
  if (open) return
  stage.pause()
  const voice = createVoice(stage)

  const role = orb.getAttribute('role')
  orb.removeAttribute('role')
  orb.removeAttribute('tabindex')
  orb.classList.add('greeting')

  const panel = document.createElement('div')
  panel.className = 'greet'
  panel.innerHTML = `
    <p aria-live="polite"></p>
    <div class="greet-actions">
      <button class="button primary" type="button" data-answer="yes">Yes, show me</button>
      <button class="button" type="button" data-answer="no">Not now</button>
    </div>`
  const line = panel.querySelector('p')!
  const actions = panel.querySelector<HTMLElement>('.greet-actions')!
  line.textContent = GREETING.ask.text
  // Nothing inside the panel is a click or a key on the sphere behind it.
  panel.addEventListener('click', (event) => event.stopPropagation())
  panel.addEventListener('keydown', (event) => event.stopPropagation())
  orb.append(panel)
  if (!still()) {
    panel.animate(
      [{ opacity: 0, transform: 'translate(-50%, 8px) scale(0.97)' }, { opacity: 1, transform: 'translate(-50%, 0) scale(1)' }],
      { duration: 240, easing: EASE_OUT },
    )
  }
  panel.querySelector<HTMLButtonElement>('[data-answer="yes"]')!.focus({ preventScroll: true })

  let closed = false
  const close = () => {
    if (closed) return
    closed = true
    open = null
    voice.close()
    removeEventListener('keydown', onKey)
    orb.classList.remove('greeting')
    if (role) orb.setAttribute('role', role)
    orb.setAttribute('tabindex', '0')
    if (still()) return panel.remove()
    panel.animate(
      [{ opacity: 1 }, { opacity: 0, transform: 'translate(-50%, 4px) scale(0.98)' }],
      { duration: 160, easing: 'ease-out' },
    ).finished.then(() => panel.remove(), () => panel.remove())
    // A hidden tab pauses animations, and the panel would linger until seen.
    setTimeout(() => panel.remove(), 400)
  }

  const dismiss = () => { close(); stage.resume(); orb.focus({ preventScroll: true }) }
  const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') dismiss() }
  addEventListener('keydown', onKey)
  open = { dismiss }

  actions.addEventListener('click', async (event) => {
    const answer = (event.target as HTMLElement).closest('button')?.dataset.answer
    if (answer === 'yes') {
      close()
      onYes()
    } else if (answer === 'no') {
      actions.hidden = true
      line.textContent = GREETING.later.text
      await voice.say(GREETING.later.id, GREETING.later.text)
      if (!closed) dismiss()
    }
  })

  void voice.say(GREETING.ask.id, GREETING.ask.text)
}
