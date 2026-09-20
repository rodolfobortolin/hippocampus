import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * O volume de quem está speaking now, de 0 a 1 — o seu pelo microfone, o dele
 * pelo áudio da answer. É o que faz o núcleo se mexer junto com a voice.
 */
export function useAudioLevel() {
  const [level, setNivel] = useState(0)
  const audioContext = useRef<AudioContext | null>(null)
  const stop = useRef<(() => void) | null>(null)
  // Um elemento de áudio só pode virar source uma vez por audioContext.
  const sources = useRef(new WeakMap<HTMLMediaElement, MediaElementAudioSourceNode>())

  const ensureContext = () => {
    if (!audioContext.current || audioContext.current.state === 'closed') {
      audioContext.current = new AudioContext()
    }
    void audioContext.current.resume()
    return audioContext.current
  }

  const measure = (analyser: AnalyserNode, aoFim?: () => void) => {
    const data = new Uint8Array(analyser.fftSize)
    let frame = 0
    const step = () => {
      analyser.getByteTimeDomainData(data)
      let sum = 0
      for (const sample of data) sum += ((sample - 128) / 128) ** 2
      setNivel(Math.min(1, Math.sqrt(sum / data.length) * 5))
      frame = requestAnimationFrame(step)
    }
    step()
    return () => {
      cancelAnimationFrame(frame)
      setNivel(0)
      aoFim?.()
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
      // Sem microfone o núcleo ainda muda de state; só não pulsa junto.
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
      // Sem isto o áudio entra no grafo e nunca chega no alto-falante.
      source.connect(ac.destination)
      stop.current = measure(analyser)
    } catch {
      // Se o navegador recusar, cai no pulso sintético.
    }
  }, [finish])

  /** Quando não há áudio para analisar (voice do sistema), um pulso convincente. */
  const pulseAlone = useCallback(() => {
    finish()
    let frame = 0
    let phase = Math.random() * 10
    const step = () => {
      phase += 0.09
      const wave = 0.34 + Math.sin(phase * 2.3) * 0.16 + Math.sin(phase * 5.7) * 0.1
      setNivel(Math.max(0, Math.min(1, wave)))
      frame = requestAnimationFrame(step)
    }
    step()
    stop.current = () => { cancelAnimationFrame(frame); setNivel(0) }
  }, [finish])

  useEffect(() => () => {
    stop.current?.()
    void audioContext.current?.close()
  }, [])

  return { level, listenToMic, listenToAudio, pulseAlone, finish }
}
