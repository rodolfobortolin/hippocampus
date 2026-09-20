import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../lib/api.ts'

type State = 'idle' | 'listening' | 'transcribing'

/**
 * Escuta por gravação, não pela API de voice do navegador.
 *
 * `webkitSpeechRecognition` existe no Electron mas não funciona: ela depende de
 * um serviço do Google para o qual só o Chrome tem credencial, então falha na
 * hour com error de rede — o microfone acendia por um segundo e apagava. Aqui o
 * áudio é gravado, a speech é detectada pelo volume, e o trecho vai para a
 * transcrição quando você para de speak.
 */
/** Quanto tempo o microfone wait por alguém, antes de desistir sozinho. */
const PATIENCE = 7000

export function useListening(
  aoOuvir: (text: string) => void,
  textos: { didNotCatch: string; micDenied: string } =
    { didNotCatch: 'Não entendi.', micDenied: 'O microfone foi negado.' },
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
        // Trecho curto demais é clique sem speech; não vale uma chamada.
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
      // Aberto pela palavra de ativação, o microfone pode ter sido openedAt por
      // engano — a palavra sai de um vídeo, de uma conversa ao lado. Sem isto
      // ele ficava openedAt para sempre esperando alguém que nunca spoke, com o
      // ponto laranja aceso e a detecção de chamada quebrada junto.
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
          // Um segundo e meio de silêncio depois de speak finish o trecho.
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
