import { useEffect, useRef, useState } from 'react'
import { api, type Status } from '../lib/api.ts'
import { Markdown } from '../lib/markdown.tsx'
import { useAudioLevel } from '../hooks/useAudioLevel.ts'
import { useListening } from '../hooks/useListening.ts'
import { useSocket } from '../hooks/useSocket.ts'
import { useLive } from '../hooks/useLive.ts'
import { useSpeech } from '../hooks/useSpeech.ts'
import { Core, type CoreState } from './Core.tsx'
import { IconSend, IconMicrophone, IconSound, IconMuted, IconStop } from './Icons.tsx'
import { useLanguage } from '../lib/language.tsx'

type Message = { of: 'me' | 'it'; text: string }

export function Chat({ status }: { status: Status | null }) {
  const { t, language, settings } = useLanguage()
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [thinking, setThinking] = useState(false)
  const [tool, setTool] = useState('')
  const [model, setModel] = useState('')
  const [state, setState] = useState<CoreState>('idle')
  // Se a question veio falada, a answer volta falada — esperar text depois
  // after asking out loud is strange. Typed, it stays quiet.
  const askedByVoice = useRef(false)
  const [speaking, setSpeaking] = useState(false)
  const [alwaysAloud, setAlwaysAloud] = useState(
    () => localStorage.getItem('hippocampus.voice') === 'always')
  const speakAnswer = useRef<(text: string) => void>(() => {})
  const thread = useRef<HTMLDivElement>(null)
  const answerRef = useRef('')
  const toCore = useRef<(message: unknown) => boolean>(() => false)
  const { level: answerLevel, listenToAudio, pulseAlone, finish, setExternalLevel } = useAudioLevel()

  // The live voice: it hears while you speak and you can cut it off mid-sentence.
  // Off by default — it bills for the time the session stays open, and that is
  // the person's call to make on the Settings screen.
  const live = useLive({
    offer: (sdp) => { toCore.current({ type: 'live-offer', sdp }) },
    stop: () => { toCore.current({ type: 'live-stop' }) },
    onLevel: setExternalLevel,
  })
  const liveOn = live.phase !== 'off'
  // The socket handler is installed once, so this has to be a ref rather than
  // the value it closed over on the first render.
  const liveRef = useRef(false)
  liveRef.current = liveOn || settings?.voiceMode === 'live'
  // Listening records and transcribes; its level is the one from your microphone.
  const listening = useListening((utterance) => { askedByVoice.current = true; send(utterance) }, t.common)
  const isListening = listening.state === 'listening'
  const level = isListening ? listening.level : answerLevel

  const { connected, send: sendToCore } = useSocket(api.socket, (data) => {
      if (data.type === 'thinking') { setThinking(true); setTool(''); setModel(''); setState('thinking') }
      // Which model jev chose for this request. Visible on purpose: automatic
      // routing nobody sees is routing nobody trusts.
      if (data.type === 'model') setModel(String(data.model).replace(/^claude-|-\d{8}$/g, ''))
      if (data.type === 'tool') {
        // The core only turns to water when it is genuinely reading the
        // database; the SDK's internal tool lookup is of no interest to anyone
        // watching.
        setTool(data.name)
        setState(data.name ? 'tool' : 'thinking')
      }
      // A piece of text arriving: write it at once, into its last message.
      if (data.type === 'delta') {
        answerRef.current += data.text
        setState('thinking')
        setMessages((current) => {
          const last = current[current.length - 1]
          if (last?.of === 'it') {
            return [...current.slice(0, -1), { ...last, text: last.text + data.text }]
          }
          return [...current, { of: 'it', text: data.text }]
        })
      }
      if (data.type === 'text') {
        setState('thinking')
        answerRef.current = `${answerRef.current}\n${data.text}`.trim()
        setMessages((current) => {
          const last = current[current.length - 1]
          // Splices the pieces of one turn into a single message.
          if (last?.of === 'it') {
            return [...current.slice(0, -1), { ...last, text: `${last.text}\n\n${data.text}`.trim() }]
          }
          return [...current, { of: 'it', text: data.text }]
        })
      }
      if (data.type === 'end') {
        setThinking(false)
        setTool('')
        const text = data.text || answerRef.current
        // The live session says the answer itself; reading it out here as well
        // puts two voices on the same sentence.
        if (text && !liveRef.current && (askedByVoice.current || alwaysAloud)) speakAnswer.current(text)
        else setState('idle')
        askedByVoice.current = false
      }
      // The wake word toggles: speaking, it goes quiet; quiet, it starts
      // listening. The core broadcasts it to every open screen, so this runs
      // while the floating core is answering the same word — and without the
      // mode check the panel would record a second copy of the same sentence
      // through a second microphone.
      if (data.type === 'wake' && settings?.voiceMode !== 'live') {
        if (speaking) voice.stop()
        else if (listening.state === 'idle' && !thinking) listening.toggle()
      }
      // The live session's own traffic: the answer to the offer, what it heard,
      // what it said, and the moment it closes on the other side.
      if (data.type === 'live-answer') void live.accept(String(data.sdp))
      if (data.type === 'live' && !data.on) live.dropped()
      if (data.type === 'listening') setState('listening')
      if (data.type === 'heard' && data.text) {
        setMessages((current) => [...current, { of: 'me', text: String(data.text) }])
        // A new turn clears what went wrong in the last one.
        listening.clearError()
      }
      if (data.type === 'error') {
        setThinking(false)
        setState('error')
        setMessages((current) => [...current, { of: 'it', text: data.error }])
        setTimeout(() => setState('idle'), 2600)
      }
  })

  useEffect(() => {
    thread.current?.scrollTo({ top: thread.current.scrollHeight, behavior: 'smooth' })
  }, [messages, thinking])

  useEffect(() => { toCore.current = sendToCore }, [sendToCore])

  useEffect(() => {
    if (liveOn) return
    if (listening.state === 'listening') setState('listening')
    else if (listening.state === 'transcribing') setState('thinking')
    else if (!thinking) setState('idle')
  }, [listening.state, thinking, liveOn])

  const send = (question: string) => {
    const clear = question.trim()
    if (!clear || thinking) return
    if (!sendToCore({ type: 'question', text: clear })) {
      // Never swallow the question quietly: the text stays in the field.
      setState('error')
      setMessages((current) => [...current, { of: 'it', text: t.chat.coreIsDown }])
      setTimeout(() => setState('idle'), 2600)
      return
    }
    // Perguntar de novo cala o que estava sendo spoken.
    voice.stop()
    // The core says what it heard, for typed and spoken alike, and every screen
    // gets it. Adding it here too would put a typed question on screen twice —
    // and would leave the panel showing only the turns that started in it.
    answerRef.current = ''
    setText('')
  }

  const voice = useSpeech({
    hasOwnVoice: Boolean(status?.voice),
    language,
    restOnScreen: t.common.restOnScreen,
    onStart: () => { setState('speaking'); setSpeaking(true) },
    onEnd: () => { setState('idle'); setSpeaking(false); finish() },
    onAudio: listenToAudio,
    onPulse: pulseAlone,
  })
  const speech = voice.speak
  speakAnswer.current = voice.speak
  const opening = !messages.length

  return (
    <div className="chat">
      <div className="thread" ref={thread}>
        {opening && (
          <div className="opening">
            <Core state={state} level={level} size="large" />
            <h2>{t.chat.title} <b>{t.chat.titleStrong}</b>.</h2>
            <p>{t.chat.explanation}</p>
            <div className="chat-shortcuts">
              {t.chat.suggestions.map((suggestion) => (
                <button key={suggestion} onClick={() => send(suggestion)}>
                  {suggestion.length > 58 ? `${suggestion.slice(0, 56)}…` : suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((line, index) => (
          <div key={index} className={`message ${line.of === 'me' ? 'mine' : 'theirs'} appear`}>
            {line.of === 'me' ? line.text : <Markdown text={line.text} />}
            {line.of === 'it' && (
              <button className="icon" onClick={() => speech(line.text)} title={t.chat.listen}
                style={{ marginTop: 6 }}>
                <IconSound />
              </button>
            )}
          </div>
        ))}

        {(listening.error || live.error) && (
          <div className="message theirs appear" style={{ color: 'var(--communication)' }}>
            {listening.error
              || (live.error === 'live-no-answer' ? t.chat.liveNoAnswer : live.error)}
          </div>
        )}

        {thinking && (
          <div className="tool appear">
            {tool ? `${t.chat.lookingUp} ${tool}…` : t.chat.thinking}
            {model && <span className="model">{model}</span>}
          </div>
        )}
      </div>

      <div className="composer">
        {!opening && <Core state={state} level={level} size="small" />}
        <textarea
          value={text}
          onChange={(evento) => setText(evento.target.value)}
          onKeyDown={(evento) => {
            if (evento.key === 'Enter' && !evento.shiftKey) { evento.preventDefault(); send(text) }
          }}
          placeholder={
            !connected ? t.chat.reconnecting
              : isListening ? t.chat.listening
              : listening.state === 'transcribing' ? t.chat.transcribing
              : t.chat.placeholder
          }
          rows={1}
          style={{ height: Math.min(160, 24 + text.split('\n').length * 20) }}
        />
        {/* While speaking, this button silences. Idle, it turns on and off the mode
            de responder sempre speaking. */}
        <button
          className={`icon ${speaking ? 'speaking' : alwaysAloud ? 'active' : ''}`}
          onClick={() => {
            if (speaking) { voice.stop(); setSpeaking(false); return }
            const next = !alwaysAloud
            setAlwaysAloud(next)
            localStorage.setItem('hippocampus.voice', next ? 'always' : 'on-request')
          }}
          title={speaking ? t.chat.stopTalking
            : alwaysAloud ? t.chat.alwaysAloud
            : t.chat.aloudWhenYouSpeak}>
          {speaking ? <IconStop /> : alwaysAloud ? <IconSound /> : <IconMuted />}
        </button>
        {settings?.voiceMode === 'live' ? (
          // Live: one press opens the session and it keeps listening; the next
          // press closes it. Nothing is recorded, here or anywhere.
          <button
            className={`icon ${liveOn ? 'active' : ''}`}
            onClick={() => (liveOn ? live.stop() : void live.start())}
            disabled={live.phase === 'connecting' || !connected}
            title={liveOn ? t.chat.liveStop
              : live.phase === 'connecting' ? t.chat.liveConnecting
              : t.chat.liveStart}>
            <IconMicrophone />
          </button>
        ) : (
          <button
            className={`icon ${isListening ? 'active' : ''}`}
            onClick={listening.toggle}
            disabled={listening.state === 'transcribing'}
            title={isListening ? t.chat.stopListening : t.chat.speak}>
            <IconMicrophone />
          </button>
        )}
        <button className="icon" onClick={() => send(text)}
          disabled={!text.trim() || thinking || !connected} title={connected ? t.chat.send : t.chat.coreIsDown}>
          <IconSend />
        </button>
      </div>
    </div>
  )
}
