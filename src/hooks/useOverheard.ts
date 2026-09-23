import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * How loud the room is, as the wake-word listener hears it.
 *
 * That microphone is open all day and records nothing, which leaves no sign
 * at all that it is working. This turns the number it reports into movement:
 * the sphere stirs while you speak, before anything is being recorded, so
 * "it is hearing me" is something you can see rather than believe.
 *
 * Held back on purpose. At full strength it looks exactly like the sphere
 * during a recording, and the difference between being heard and being
 * recorded is the one thing this app cannot blur.
 */
const RESTRAINT = 0.55

/** With no word for this long the room is quiet — or the listener is gone. */
const FADE = 600

export function useOverheard() {
  const [level, setLevel] = useState(0)
  const fade = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const heard = useCallback((value: unknown) => {
    const loud = Number(value)
    const next = Number.isFinite(loud) ? Math.min(1, Math.max(0, loud)) : 0
    setLevel(next * RESTRAINT)
    clearTimeout(fade.current)
    // The listener stops sending when the room goes quiet, and stops for good
    // when someone turns it off. A sphere left mid-breath would be claiming a
    // microphone that is closed.
    if (next > 0) fade.current = setTimeout(() => setLevel(0), FADE)
  }, [])

  useEffect(() => () => clearTimeout(fade.current), [])

  return { level, heard }
}
