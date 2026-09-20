import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * The volume of whoever is speaking now, from 0 to 1 — yours from the
 * microphone, its own from the answer's audio. This is what makes the core move
 * along with the voice.
 */
export function useAudioLevel() {
  const [level, setLevel] = useState(0)
  const audioContext = useRef<AudioContext | null>(null)
  const stop = useRef<(() => void) | null>(null)
  // An audio element can only become a source once per audio context.
  const sources = useRef(new WeakMap<HTMLMediaElement, MediaElementAudioSourceNode>())

  const ensureContext = () => {
    if (!audioContext.current || audioContext.current.state === 'closed') {
      audioContext.current = new AudioContext()
    }
    void audioContext.current.resume()
    return audioContext.current
  }

  const measure = (analyser: AnalyserNode, atEnd?: () => void) => {
    const data = new Uint8Array(analyser.fftSize)
    let frame = 0
    const step = () => {
      analyser.getByteTimeDomainData(data)
      let sum = 0
      for (const sample of data) sum += ((sample - 128) / 128) ** 2
      setLevel(Math.min(1, Math.sqrt(sum / data.length) * 5))
      frame = requestAnimationFrame(step)
    }
    step()
    return () => {
      cancelAnimationFrame(frame)
      setLevel(0)
      atEnd?.()
    }
  }

  const finish = useCallback(() => {
    stop.current?.()
    stop.current = null
  }, [])

  const listenToMic = useCallback(async () => {
    finish()
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const ac = ensureContext()
      const analyser = ac.createAnalyser()
      analyser.fftSize = 512
      ac.createMediaStreamSource(stream).connect(analyser)
      stop.current = measure(analyser, () => stream.getTracks().forEach((t) => t.stop()))
    } catch {
      // With no microphone the core still changes state; it just does not pulse.
    }
  }, [finish])

  const listenToAudio = useCallback((audio: HTMLAudioElement) => {
    finish()
    try {
      const ac = ensureContext()
      let source = sources.current.get(audio)
      if (!source) {
        source = ac.createMediaElementSource(audio)
        sources.current.set(audio, source)
      }
      const analyser = ac.createAnalyser()
      analyser.fftSize = 512
      source.connect(analyser)
      // Without this the audio enters the graph and never reaches the speaker.
      source.connect(ac.destination)
      stop.current = measure(analyser)
    } catch {
      // If the browser refuses, fall back to the synthetic pulse.
    }
  }, [finish])

  /** When there is no audio to analyse (the system voice), a convincing pulse. */
  const pulseAlone = useCallback(() => {
    finish()
    let frame = 0
    let phase = Math.random() * 10
    const step = () => {
      phase += 0.09
      const wave = 0.34 + Math.sin(phase * 2.3) * 0.16 + Math.sin(phase * 5.7) * 0.1
      setLevel(Math.max(0, Math.min(1, wave)))
      frame = requestAnimationFrame(step)
    }
    step()
    stop.current = () => { cancelAnimationFrame(frame); setLevel(0) }
  }, [finish])

  useEffect(() => () => {
    stop.current?.()
    void audioContext.current?.close()
  }, [])

  /** A level measured somewhere else — the live session measures its own. */
  const setExternalLevel = useCallback((value: number) => setLevel(value), [])

  return { level, listenToMic, listenToAudio, pulseAlone, finish, setExternalLevel }
}
