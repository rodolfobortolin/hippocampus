import { useCallback, useEffect, useRef } from 'react'
import { api } from '../lib/api.ts'
import { SPEECH_RATE } from '../lib/format.ts'

/**
 * The answers' voice — with one mouth only.
 *
 * Each answer used to create a new audio without ending the previous one, and
 * nothing interrupted what was already playing: you could stack voices on top
 * of each other with no way to shut them up short of quitting the app. Here at
 * most one utterance is alive, and `stop` ends both the audio and the system
 * voice.
 */
const LIMIT = 900

export function useSpeech(options: {
  hasOwnVoice: boolean
  /** The language of the system voice, when the app's own voice is unavailable. */
  language?: string
  /** O que dizer ao cortar uma answer long. */
  restOnScreen?: string
  onStart?: () => void
  onEnd?: () => void
  onAudio?: (audio: HTMLAudioElement) => void
  onPulse?: () => void
}) {
  const current = useRef<HTMLAudioElement | null>(null)
  const ref = useRef(options)
  ref.current = options

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
    // One mouth only: whatever was being spoken stops now.
    stop()

    const clean = text.replace(/[*#`>]/g, '').replace(/\s+/g, ' ').trim()
    if (!clean) return

    // A long answer becomes minutes of audio nobody can skim. Speak the
    // beginning and leave the rest to reading, which is faster anyway.
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
      if (!answer.ok) throw new Error('voice unavailable')
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

  // Closing the tab or switching screens must not leave a voice playing alone.
  useEffect(() => stop, [stop])

  return { speak, stop, speaking }
}
