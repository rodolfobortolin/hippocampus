import { useEffect, useRef, useState } from 'react'

/**
 * Once per launch of the app, not once per window.
 *
 * The shell stamps when the process started. This app lives in the menu bar:
 * the window is closed and opened again all day, and the page cannot tell that
 * apart from a fresh start — so it asks. Same stamp, already seen, no opening.
 *
 * In a plain browser there is no shell to ask, so it falls back to a quiet
 * hour: long enough that a reload does not replay it, short enough that the
 * first visit of a working day still gets the opening.
 */
const QUIET_FOR = 60 * 60 * 1000
const LAST_SEEN = 'hippocampus.intro'

const launchedAt = (globalThis as any).hippocampus?.launchedAt as string | undefined

function firstTimeThisLaunch(): boolean {
  try {
    if (launchedAt) return localStorage.getItem(LAST_SEEN) !== launchedAt
    return Date.now() - Number(localStorage.getItem(LAST_SEEN) ?? 0) > QUIET_FOR
  } catch {
    // Private window, blocked storage: show it rather than swallow it.
    return true
  }
}

/**
 * The opening: a synapse firing that resolves into the seahorse.
 *
 * It plays muted, always. An app that makes noise when it opens is an app
 * people turn off, and this one opens every morning.
 *
 * Any click and any key skip it, and it never blocks: the interface is already
 * mounted underneath, so the four seconds cost nothing but the look of them.
 */
export function Intro() {
  const [playing, setPlaying] = useState(firstTimeThisLaunch)
  const [leaving, setLeaving] = useState(false)
  const video = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (!playing) return
    try {
      localStorage.setItem(LAST_SEEN, launchedAt || String(Date.now()))
    } catch { /* fine without it */ }

    const leave = () => setLeaving(true)
    // The opening is decoration. Whatever happens — a codec that will not
    // decode, a transition event that never arrives, a frame that stalls — it
    // has to come off the screen on its own. A decoration that can cover the
    // app is worse than no decoration.
    const ceiling = setTimeout(() => setPlaying(false), 9000)
    window.addEventListener('keydown', leave)
    window.addEventListener('pointerdown', leave)
    // A video that fails to decode must not leave a black rectangle on top of
    // the app — the opening is decoration, and decoration never blocks.
    const failed = setTimeout(() => { if (!video.current?.currentTime) leave() }, 2500)
    return () => {
      window.removeEventListener('keydown', leave)
      window.removeEventListener('pointerdown', leave)
      clearTimeout(failed)
      clearTimeout(ceiling)
    }
  }, [playing])

  if (!playing) return null

  return (
    <div
      className={`intro ${leaving ? 'leaving' : ''}`}
      onTransitionEnd={() => leaving && setPlaying(false)}
      onClick={() => setLeaving(true)}
      aria-hidden>
      <video
        ref={video}
        src="/intro.mp4"
        autoPlay
        muted
        playsInline
        onEnded={() => setLeaving(true)}
        onError={() => setLeaving(true)}
      />
    </div>
  )
}
