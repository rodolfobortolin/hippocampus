import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../lib/api.ts'

type State = 'idle' | 'listening' | 'transcribing'

/**
 * Listens by recording, not through the browser's speech API.
 *
 * `webkitSpeechRecognition` exists in Electron but does not work: it depends on
 * a Google service only Chrome has credentials for, so it fails at
 * hour com error de rede — o microfone acendia por um segundo e apagava. Aqui o
 * the audio is recorded, speech is detected by volume, and the stretch goes to
 * transcription when you stop speaking.
 */
/** How long the microphone waits for someone before giving up on its own. */
const PATIENCE = 7000

export function useListening(
  aoOuvir: (text: string) => void,
  textos: { didNotCatch: string; micDenied: string } =
    { didNotCatch: 'I did not catch that.', micDenied: 'The microphone was denied.' },
) {
  const [state, setState] = useState<State>('idle')
  const [level, setNivel] = useState(0)
  const [error, setErro] = useState('')

  const recorder = useRef<MediaRecorder | null>(null)
  const stream = useRef<MediaStream | null>(null)
  const audioContext = useRef<AudioContext | null>(null)
  const frame = useRef(0)
  const chunks = useRef<Blob[]>([])
  const spoke = useRef(false)
  const receive = useRef(aoOuvir)
  receive.current = aoOuvir
  const says = useRef(textos)
  says.current = textos

  const teardown = useCallback(() => {
    cancelAnimationFrame(frame.current)
    stream.current?.getTracks().forEach((faixa) => faixa.stop())
    stream.current = null
    void audioContext.current?.close().catch(() => {})
    audioContext.current = null
    setNivel(0)
  }, [])

  const stop = useCallback(() => {
    if (recorder.current?.state === 'recording') recorder.current.stop()
  }, [])

  const begin = useCallback(async () => {
    setErro('')
    try {
      const input = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      })
      stream.current = input

      const ac = new AudioContext()
      audioContext.current = ac
      const analyser = ac.createAnalyser()
      analyser.fftSize = 512
      ac.createMediaStreamSource(input).connect(analyser)
      const data = new Uint8Array(analyser.fftSize)

      const recording = new MediaRecorder(input, { mimeType: 'audio/webm' })
      recorder.current = recording
      chunks.current = []
      spoke.current = false
      recording.ondataavailable = (evento) => {
        if (evento.data.size) chunks.current.push(evento.data)
      }

      recording.onstop = async () => {
        teardown()
        const audio = new Blob(chunks.current, { type: 'audio/webm' })
        // A stretch too short is a click with no speech; not worth a call.
        if (!spoke.current || audio.size < 4000) { setState('idle'); return }
        setState('transcribing')
        try {
          const text = await api.transcribe(audio)
          setState('idle')
          if (text) receive.current(text)
          else setErro(says.current.didNotCatch)
        } catch (falha) {
          setState('idle')
          setErro((falha as Error).message)
        }
      }

      let silenceSince = 0
      // Opened by the wake word, the microphone may have been opened by
      // mistake — the word comes out of a video, out of a conversation nearby.
      // Without this it stayed open forever waiting for someone who never
      // spoke, with the orange dot lit and call detection broken alongside.
      const openedAt = performance.now()
      const follow = () => {
        analyser.getByteTimeDomainData(data)
        let sum = 0
        for (const sample of data) sum += ((sample - 128) / 128) ** 2
        const volume = Math.min(1, Math.sqrt(sum / data.length) * 5)
        setNivel(volume)

        const now = performance.now()
        if (!spoke.current && now - openedAt > PATIENCE) { stop(); return }
        if (volume > 0.08) {
          spoke.current = true
          silenceSince = 0
        } else if (spoke.current) {
          if (!silenceSince) silenceSince = now
          // A second and a half of silence after speech ends the stretch.
          else if (now - silenceSince > 1500) { stop(); return }
        }
        frame.current = requestAnimationFrame(follow)
      }

      recording.start()
      setState('listening')
      follow()
    } catch (falha) {
      teardown()
      setState('idle')
      setErro(
        (falha as Error).name === 'NotAllowedError'
          ? says.current.micDenied
          : (falha as Error).message,
      )
    }
  }, [teardown, stop])

  const toggle = useCallback(() => {
    if (state === 'listening') stop()
    else if (state === 'idle') void begin()
  }, [state, stop, begin])

  useEffect(() => () => { stop(); teardown() }, [stop, teardown])

  return { state, level, error, toggle, clearError: () => setErro('') }
}
