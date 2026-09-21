import { useEffect, useRef, useState } from 'react'
import { api, type Status } from './lib/api.ts'
import { Core, type CoreState } from './components/Core.tsx'
import { useListening } from './hooks/useListening.ts'
import { useAudioLevel } from './hooks/useAudioLevel.ts'
import { useSocket } from './hooks/useSocket.ts'
import { useLive } from './hooks/useLive.ts'
import { useSpeech } from './hooks/useSpeech.ts'
import { useLanguage } from './lib/language.tsx'
import { Markdown } from './lib/markdown.tsx'

/** Electron's bridge. In a plain browser it does not exist, and the drag goes with it. */
const bridge = (globalThis as any).hippocampus as {
  moveCore?: (dx: number, dy: number) => void
  settleCore?: () => void
  hideCore?: () => void
  onWake?: (callback: () => void) => () => void
} | undefined

/**
 * The floating core: a frameless window with the sphere and nothing else.
 *
 * It is the app when you do not want the app — it sits over whatever you are
 * doing, listens with a click and answers out loud. The text shows only
 * enough to glance at; anyone who wants the whole thing opens the panel.
 *
 * Dragging the sphere moves the window and the position is stored. The drag is
 * done by hand rather than with `-webkit-app-region`, because that property
 * swallows the click — and the click is how you talk to it.
 */
export function FloatingCore() {
  const { t, language, settings } = useLanguage()
  const [state, setState] = useState<CoreState>('idle')
  const [answer, setAnswer] = useState('')
  const [question, setQuestion] = useState('')
  const [status, setStatus] = useState<Status | null>(null)
  const { level: answerLevel, listenToAudio, pulseAlone, finish } = useAudioLevel()

  const answerRef = useRef('')
  const speakAnswer = useRef<(text: string) => void>(() => {})
  const dragged = useRef(false)
  const wakePending = useRef(false)
  const toCore = useRef<(message: unknown) => boolean>(() => false)
  const { level: liveLevel, setExternalLevel } = useAudioLevel()

  const live = useLive({
    offer: (sdp) => { toCore.current({ type: 'live-offer', sdp }) },
    stop: () => { toCore.current({ type: 'live-stop' }) },
    onLevel: setExternalLevel,
  })
  const liveOn = live.phase !== 'off'
  const liveWanted = settings?.voiceMode === 'live'
  // The socket handler is installed once; a plain variable there would be the
  // one from the first render, when the settings had not arrived yet.
  const liveRef = useRef(false)
  liveRef.current = liveOn || liveWanted

  // Switching the mode off in Settings has to let go of the microphone here
  // too. Left open, the session keeps answering while this screen — back in
  // push mode — reads the same answer out as well.
  useEffect(() => {
    if (settings && settings.voiceMode !== 'live' && live.phase !== 'off') live.stop()
  }, [settings?.voiceMode, live.phase])

  // The core tags every answer with the screen that asked. Every screen shows
  // the whole conversation; only the one that asked reads it out loud.
  const myScreen = useRef('')
  const iAsked = (data: any) => !data.asker || data.asker === myScreen.current

  const { connected, send } = useSocket(api.socket, (data) => {
    if (data.type === 'thinking') { setState('thinking'); setAnswer('') }
    if (data.type === 'tool') setState(data.name ? 'tool' : 'thinking')
    if (data.type === 'delta') {
      answerRef.current += data.text
      setAnswer(answerRef.current)
    }
    if (data.type === 'text') {
      answerRef.current = `${answerRef.current}\n${data.text}`.trim()
      setAnswer(answerRef.current)
    }
    if (data.type === 'hello') myScreen.current = String(data.screen)
    if (data.type === 'end') {
      const text = data.text || answerRef.current
      setAnswer(text)
      // In live mode the session is the voice: it already received this answer
      // from the core and says it in its own words. Reading it out here too
      // means two voices on the same sentence, a beat apart.
      // Only the screen that asked reads it out; the others simply stop
      // thinking. Without this a screen that watched someone else's turn sat
      // in "thinking" forever, because idle was only ever reached by finishing
      // a sentence it never started.
      if (!liveRef.current && iAsked(data)) speakAnswer.current(text)
      else setState('idle')
    }
    if (data.type === 'wake') wake()
    if (data.type === 'live-answer') void live.accept(String(data.sdp))
    if (data.type === 'live' && !data.on) live.dropped()
    if (data.type === 'listening') setState('listening')
    if (data.type === 'heard' && data.text) {
      setQuestion(String(data.text))
      setAnswer('')
      // A new turn clears what went wrong in the last one.
      listening.clearError()
    }
    if (data.type === 'error') { setState('error'); setAnswer(data.error) }
  })

  const listening = useListening((utterance) => {
    setQuestion(utterance)
    answerRef.current = ''
    send({ type: 'question', text: utterance })
  }, t.common)

  /**
   * Speaking, it goes quiet. Quiet, it starts listening. The click's own gesture.
   *
   * In live mode there is nothing to interrupt and nothing to record: the press
   * opens the session or closes it, and in between it is simply listening.
   */
  const wake = () => {
    // The shortcut creates this window and tells it to wake on the same breath,
    // so the first call can land before the settings have arrived. Acting then
    // means guessing the mode, and guessing wrong opens the microphone twice:
    // the recorder now, the live session on the next press, both listening.
    if (!settings) {
      wakePending.current = true
      return
    }
    if (liveWanted) {
      if (liveOn) live.stop()
      else if (live.phase !== 'connecting') void live.start()
      return
    }
    if (state === 'speaking') voice.stop()
    else if (listening.state === 'idle') listening.toggle()
  }
  const wakeRef = useRef(wake)
  wakeRef.current = wake

  // Whatever asked while the settings were still on their way.
  useEffect(() => {
    if (!settings || !wakePending.current) return
    wakePending.current = false
    wakeRef.current()
  }, [settings])

  useEffect(() => { api.status().then(setStatus).catch(() => {}) }, [])

  /**
   * The caption goes away on its own.
   *
   * This window sits over whatever you are doing, always on top. An answer
   * that stays until the next question turns the sphere into a sticky note on
   * someone's screen — read once, then in the way for the rest of the day.
   *
   * The clock only runs when nothing is happening: it is not started while it
   * is still speaking, still listening or still thinking.
   */
  useEffect(() => {
    if (!answer && !question) return
    // A live session rests in "listening", which is not busy — only speaking
    // and thinking are.
    if (state === 'speaking' || state === 'thinking') return
    const forget = setTimeout(() => { setAnswer(''); setQuestion('') }, 25_000)
    return () => clearTimeout(forget)
  }, [answer, question, state])

  // A way out that does not need the tray menu. Whatever is open goes quiet
  // first: dismissing while it is still listening would leave the microphone
  // running behind a window nobody can see.
  const dismiss = () => {
    if (liveOn) live.stop()
    if (listening.state === 'listening') listening.toggle()
    voice.stop()
    bridge?.hideCore?.()
  }
  const dismissRef = useRef(dismiss)
  dismissRef.current = dismiss

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismissRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // The wake word and the shortcut arrive through Electron: it brings the window
  // forward and says so here, because the window may have just been born and
  // missed the notice that went through the socket.
  useEffect(() => bridge?.onWake?.(() => wakeRef.current()), [])

  // There is no screen to read here: the voice is the main output, and clicking
  // while it speaks is how you tell it to stop.
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

  useEffect(() => { toCore.current = send }, [send])

  useEffect(() => {
    if (liveWanted) return
    if (listening.state === 'listening') setState('listening')
    else if (listening.state === 'transcribing') setState('thinking')
  }, [listening.state, liveWanted])

  useEffect(() => {
    if (!liveWanted) return
    setState(live.phase === 'on' ? 'listening' : live.phase === 'connecting' ? 'thinking' : 'idle')
  }, [live.phase, liveWanted])

  const startDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!bridge?.moveCore) return
    dragged.current = false
    let lastX = event.screenX
    let lastY = event.screenY
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
  // At rest there is no caption at all. The panel behind it is a dark
  // rectangle, and a dark rectangle under the sphere is the one thing this
  // window is not supposed to put on someone's screen — the sphere floats over
  // whatever is there, or it is just an app in a box.
  // A live session that fails has to say so. Without this line the microphone
  // opens, the session is refused, everything resets, and the screen looks
  // exactly like a click that did nothing.
  const liveTrouble = live.error === 'live-no-answer' ? t.chat.liveNoAnswer : live.error
  // An answer is newer than the complaint above it. Put the error first and a
  // single "I did not catch that" pins itself over every reply that follows.
  const said = answer || listening.error || liveTrouble || question
  const hint = !connected ? t.chat.reconnecting
    : liveWanted ? (liveOn ? t.chat.liveOn : t.chat.liveStart)
    : t.chat.clickToSpeak

  return (
    <div className="floating">
      {/* Whether the core is answering at all. The sphere looks the same
          either way, and a sphere that cannot reach anything looks exactly
          like one waiting for you to speak. */}
      <button
        className="floating-close"
        onClick={dismiss}
        title={t.common.close}
        aria-label={t.common.close}>
        ×
      </button>
      <i className={`floating-link ${connected ? 'alive' : ''}`}
        title={connected ? t.chat.connected : t.chat.reconnecting} />

      <button
        className="floating-orb"
        onPointerDown={startDrag}
        onClick={() => {
          // The click that closes a drag is not a request to talk.
          if (dragged.current) { dragged.current = false; return }
          if (liveWanted) return wake()
          if (state === 'speaking') voice.stop()
          else listening.toggle()
        }}
        title={liveWanted
          ? (liveOn ? t.chat.liveStop : live.phase === 'connecting' ? t.chat.liveConnecting : t.chat.liveStart)
          : state === 'speaking' ? t.chat.stopTalking
          : isListening ? t.chat.stopListening
          : t.chat.speak}>
        <Core
          state={state}
          level={liveWanted ? liveLevel : isListening ? listening.level : answerLevel}
          size="floating"
        />
      </button>

      {said ? (
        <div className={`floating-caption ${answer ? 'long' : ''}`}>
          {question && answer && <b>{question}</b>}
          {/* The model writes markdown whether or not anyone renders it, so a
              caption that prints it raw shows asterisks around the words it
              meant to emphasise. */}
          {answer && said === answer ? <Markdown text={said} /> : <p>{said}</p>}
        </div>
      ) : (
        // The hint carries no panel: it is lit text over the desktop, readable
        // on light and dark alike because the glow comes from the letters.
        <p className="floating-hint">{hint}</p>
      )}
    </div>
  )
}
