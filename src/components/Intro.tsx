import { useEffect, useRef, useState } from 'react'

/** Long enough that reopening the window does not replay it, short enough that
 *  the first launch of a working day still gets the opening. */
const QUIET_FOR = 60 * 60 * 1000
const LAST_SEEN = 'hippocampus.intro'

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
  const [playing, setPlaying] = useState(() => {
    try {
      return Date.now() - Number(localStorage.getItem(LAST_SEEN) ?? 0) > QUIET_FOR
    } catch {
      // Private window, blocked storage: show it rather than swallow it.
      return true
    }
  })
  const [leaving, setLeaving] = useState(false)
  const video = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (!playing) return
    try { localStorage.setItem(LAST_SEEN, String(Date.now())) } catch { /* fine without it */ }

    const leave = () => setLeaving(true)
    window.addEventListener('keydown', leave)
    window.addEventListener('pointerdown', leave)
    // A video that fails to decode must not leave a black rectangle on top of
    // the app — the opening is decoration, and decoration never blocks.
    const failed = setTimeout(() => { if (!video.current?.currentTime) leave() }, 2500)
    return () => {
      window.removeEventListener('keydown', leave)
      window.removeEventListener('pointerdown', leave)
      clearTimeout(failed)
    }
  }, [playing])

  if (!playing) return null

  return (
    <div
      className={`intro ${leaving ? 'saindo' : ''}`}
      onTransitionEnd={() => leaving && setPlaying(false)}
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
