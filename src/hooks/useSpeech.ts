import { useCallback, useEffect, useRef } from 'react'
import { api } from '../lib/api.ts'
import { SPEECH_RATE } from '../lib/format.ts'

/**
 * A voice das respostas — com uma boca só.
 *
 * Antes cada answer criava um áudio novo sem encerrar o anterior, e nada
 * interrompia o que já estava tocando: dava para empilhar vozes sobrepostas
 * sem outro jeito de calar além de closeDay o app. Aqui existe no máximo uma
 * speech viva, e `stop` finish tanto o áudio quanto a voice do sistema.
 */
const LIMIT = 900

export function useSpeech(opcoes: {
  hasOwnVoice: boolean
  /** O language da voice do sistema, quando a voice própria não está disponível. */
  language?: string
  /** O que dizer ao cortar uma answer long. */
  restOnScreen?: string
  onStart?: () => void
  onEnd?: () => void
  onAudio?: (audio: HTMLAudioElement) => void
  onPulse?: () => void
}) {
  const current = useRef<HTMLAudioElement | null>(null)
  const ref = useRef(opcoes)
  ref.current = opcoes

  const stop = useCallback(() => {
    if (current.current) {
      current.current.pause()
      current.current.src = ''
      current.current = null
    }
    speechSynthesis.cancel()
    ref.current.onEnd?.()
  }, [])

  const speak = useCallback(async (text: string) => {
    // Uma boca só: o que estava sendo spoken para now.
    stop()

    const clean = text.replace(/[*#`>]/g, '').replace(/\s+/g, ' ').trim()
    if (!clean) return

    // Resposta long vira minutes de áudio que ninguém consegue cortar. Message o
    // começo e deixa o rest para a leitura, que é mais rápida mesmo.
    const spoken = clean.length > LIMIT
      ? `${clean.slice(0, LIMIT).replace(/\s+\S*$/, '')}${ref.current.restOnScreen ?? ''}`
      : clean

    ref.current.onStart?.()

    if (!ref.current.hasOwnVoice) {
      const utterance = new SpeechSynthesisUtterance(spoken)
      utterance.lang = ref.current.language ?? 'pt-BR'
      utterance.rate = SPEECH_RATE
      utterance.onend = () => ref.current.onEnd?.()
      utterance.onerror = () => ref.current.onEnd?.()
      ref.current.onPulse?.()
      speechSynthesis.speak(utterance)
      return
    }

    try {
      const answer = await api.voice(spoken)
      if (!answer.ok) throw new Error('voz indisponível')
      const audio = new Audio(URL.createObjectURL(await answer.blob()))
      audio.playbackRate = SPEECH_RATE
      audio.onended = () => { current.current = null; ref.current.onEnd?.() }
      audio.onerror = () => { current.current = null; ref.current.onEnd?.() }
      current.current = audio
      ref.current.onAudio?.(audio)
      await audio.play()
    } catch {
      current.current = null
      ref.current.onEnd?.()
    }
  }, [stop])

  const speaking = useCallback(
    () => Boolean(current.current) || speechSynthesis.speaking, [])

  // Fechar a aba ou trocar de canvas não pode deixar voice tocando sozinha.
  useEffect(() => stop, [stop])

  return { speak, stop, speaking }
}
