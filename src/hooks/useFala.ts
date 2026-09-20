import { useCallback, useEffect, useRef } from 'react'
import { api } from '../lib/api.ts'
import { VELOCIDADE_DA_FALA } from '../lib/format.ts'

/**
 * A voz das respostas — com uma boca só.
 *
 * Antes cada resposta criava um áudio novo sem encerrar o anterior, e nada
 * interrompia o que já estava tocando: dava para empilhar vozes sobrepostas
 * sem outro jeito de calar além de fechar o app. Aqui existe no máximo uma
 * fala viva, e `parar` encerra tanto o áudio quanto a voz do sistema.
 */
const LIMITE = 900

export function useFala(opcoes: {
  temVozPropria: boolean
  /** O idioma da voz do sistema, quando a voz própria não está disponível. */
  idioma?: string
  /** O que dizer ao cortar uma resposta longa. */
  restoNaTela?: string
  aoComecar?: () => void
  aoTerminar?: () => void
  aoOuvirAudio?: (audio: HTMLAudioElement) => void
  aoPulsar?: () => void
}) {
  const atual = useRef<HTMLAudioElement | null>(null)
  const ref = useRef(opcoes)
  ref.current = opcoes

  const parar = useCallback(() => {
    if (atual.current) {
      atual.current.pause()
      atual.current.src = ''
      atual.current = null
    }
    speechSynthesis.cancel()
    ref.current.aoTerminar?.()
  }, [])

  const falar = useCallback(async (texto: string) => {
    // Uma boca só: o que estava sendo dito para agora.
    parar()

    const limpo = texto.replace(/[*#`>]/g, '').replace(/\s+/g, ' ').trim()
    if (!limpo) return

    // Resposta longa vira minutos de áudio que ninguém consegue cortar. Fala o
    // começo e deixa o resto para a leitura, que é mais rápida mesmo.
    const dito = limpo.length > LIMITE
      ? `${limpo.slice(0, LIMITE).replace(/\s+\S*$/, '')}${ref.current.restoNaTela ?? ''}`
      : limpo

    ref.current.aoComecar?.()

    if (!ref.current.temVozPropria) {
      const frase = new SpeechSynthesisUtterance(dito)
      frase.lang = ref.current.idioma ?? 'pt-BR'
      frase.rate = VELOCIDADE_DA_FALA
      frase.onend = () => ref.current.aoTerminar?.()
      frase.onerror = () => ref.current.aoTerminar?.()
      ref.current.aoPulsar?.()
      speechSynthesis.speak(frase)
      return
    }

    try {
      const resposta = await api.voz(dito)
      if (!resposta.ok) throw new Error('voz indisponível')
      const audio = new Audio(URL.createObjectURL(await resposta.blob()))
      audio.playbackRate = VELOCIDADE_DA_FALA
      audio.onended = () => { atual.current = null; ref.current.aoTerminar?.() }
      audio.onerror = () => { atual.current = null; ref.current.aoTerminar?.() }
      atual.current = audio
      ref.current.aoOuvirAudio?.(audio)
      await audio.play()
    } catch {
      atual.current = null
      ref.current.aoTerminar?.()
    }
  }, [parar])

  const falando = useCallback(
    () => Boolean(atual.current) || speechSynthesis.speaking, [])

  // Fechar a aba ou trocar de tela não pode deixar voz tocando sozinha.
  useEffect(() => parar, [parar])

  return { falar, parar, falando }
}
