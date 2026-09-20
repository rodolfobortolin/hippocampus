import { useEffect, useRef, useState } from 'react'
import { api, type Status } from './lib/api.ts'
import { Core, type CoreState } from './components/Core.tsx'
import { useListening } from './hooks/useListening.ts'
import { useAudioLevel } from './hooks/useAudioLevel.ts'
import { useSocket } from './hooks/useSocket.ts'
import { useSpeech } from './hooks/useSpeech.ts'
import { useLanguage } from './lib/language.tsx'

/** Electron's bridge. In a plain browser it does not exist, and the drag goes with it. */
const bridge = (globalThis as any).hippocampus as {
  moveCore?: (dx: number, dy: number) => void
  settleCore?: () => void
  onWake?: (callback: () => void) => () => void
} | undefined

/**
 * The floating core: a frameless window with the sphere and nothing else.
 *
 * It is the app when you do not want the app — it sits over whatever you are
 * doing, listens with a click and answers out loud. The text shows only
 * suficiente para conferir; quem quiser ler tudo abre o painel.
 *
 * Dragging the sphere moves the window and the position is stored. The drag is
 * done by hand rather than with `-webkit-app-region`, because that property
 * swallows the click — and the click is how you talk to it.
 */
export function FloatingCore() {
  const { t, language } = useLanguage()
  const [state, setState] = useState<CoreState>('idle')
  const [answer, setResposta] = useState('')
  const [question, setPergunta] = useState('')
  const [status, setStatus] = useState<Status | null>(null)
  const { level: answerLevel, listenToAudio, pulseAlone, finish } = useAudioLevel()

  const answerRef = useRef('')
  const speakAnswer = useRef<(text: string) => void>(() => {})
  const dragged = useRef(false)

  const { connected, send } = useSocket(api.socket, (data) => {
    if (data.tipo === 'thinking') { setState('thinking'); setResposta('') }
    if (data.tipo === 'tool') setState(data.name ? 'tool' : 'thinking')
    if (data.tipo === 'delta') {
      answerRef.current += data.text
      setResposta(answerRef.current)
    }
    if (data.tipo === 'texto') {
      answerRef.current = `${answerRef.current}\n${data.text}`.trim()
      setResposta(answerRef.current)
    }
    if (data.tipo === 'fim') {
      const text = data.text || answerRef.current
      setResposta(text)
      speakAnswer.current(text)
    }
    if (data.tipo === 'acordar') wake()
    if (data.tipo === 'error') { setState('error'); setResposta(data.error) }
  })

  const listening = useListening((utterance) => {
    setPergunta(utterance)
    answerRef.current = ''
    send({ tipo: 'pergunta', text: utterance })
  }, t.common)

  /** Speaking, it goes quiet. Quiet, it starts listening. The click's own gesture. */
  const wake = () => {
    if (state === 'speaking') voice.stop()
    else if (listening.state === 'idle') listening.toggle()
  }
  const wakeRef = useRef(wake)
  wakeRef.current = wake

  useEffect(() => { api.status().then(setStatus).catch(() => {}) }, [])

  // The wake word and the shortcut arrive through Electron: it brings the window
  // para a frente e avisa aqui, porque a janela pode ter acabado de nascer e
  // ter perdido o aviso que passou pelo socket.
  useEffect(() => bridge?.onWake?.(() => wakeRef.current()), [])

  // There is no screen to read here: the voice is the main output, and clicking
  // enquanto ela speech manda calar.
  const voice = useSpeech({
    hasOwnVoice: Boolean(status?.voice),
    language,
    restOnScreen: t.common.restOnScreen,
    onStart: () => setState('speaking'),
    onEnd: () => { setState('idle'); finish() },
    onAudio: listenToAudio,
    onPulse: pulseAlone,
  })
  speakAnswer.current = voice.speak

  useEffect(() => {
    if (listening.state === 'listening') setState('listening')
    else if (listening.state === 'transcribing') setState('thinking')
  }, [listening.state])

  const startDrag = (evento: React.PointerEvent<HTMLButtonElement>) => {
    if (!bridge?.moveCore) return
    dragged.current = false
    let lastX = evento.screenX
    let lastY = evento.screenY
    let travelled = 0

    const move = (e: PointerEvent) => {
      const dx = e.screenX - lastX
      const dy = e.screenY - lastY
      travelled += Math.abs(dx) + Math.abs(dy)
      lastX = e.screenX
      lastY = e.screenY
      // A three-pixel tremor while clicking is not a drag; beyond that it is.
      if (travelled > 4) {
        dragged.current = true
        bridge.moveCore?.(dx, dy)
      }
    }
    const release = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', release)
      if (dragged.current) bridge.settleCore?.()
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', release)
  }
  const isListening = listening.state === 'listening'
  const caption = listening.error || answer || question ||
    (connected ? t.chat.clickToSpeak : t.chat.reconnecting)

  return (
    <div className="floating">
      <button
        className="floating-orb"
        onPointerDown={startDrag}
        onClick={() => {
          // The click that closes a drag is not a request to talk.
          if (dragged.current) { dragged.current = false; return }
          if (state === 'speaking') voice.stop()
          else listening.toggle()
        }}
        title={state === 'speaking' ? t.chat.stopTalking
          : isListening ? t.chat.stopListening
          : t.chat.speak}>
        <Core state={state} level={isListening ? listening.level : answerLevel} size="floating" />
      </button>

      <div className={`floating-caption ${answer ? 'longa' : ''}`}>
        {question && answer && <b>{question}</b>}
        <p>{caption}</p>
      </div>
    </div>
  )
}
