import { useEffect, useRef, useState } from 'react'
import { api, type Status } from '../lib/api.ts'
import { Markdown } from '../lib/markdown.tsx'
import { useAudioLevel } from '../hooks/useAudioLevel.ts'
import { useListening } from '../hooks/useListening.ts'
import { useSocket } from '../hooks/useSocket.ts'
import { useSpeech } from '../hooks/useSpeech.ts'
import { Core, type CoreState } from './Core.tsx'
import { IconSend, IconMicrophone, IconSound, IconMuted, IconStop } from './Icons.tsx'
import { useLanguage } from '../lib/language.tsx'

type Message = { of: 'eu' | 'ele'; text: string }

export function Chat({ status }: { status: Status | null }) {
  const { t, language } = useLanguage()
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [thinking, setThinking] = useState(false)
  const [tool, setTool] = useState('')
  const [model, setModel] = useState('')
  const [state, setState] = useState<CoreState>('idle')
  // Se a question veio falada, a answer volta falada — esperar text depois
  // after asking out loud is strange. Typed, it stays quiet.
  const askedByVoice = useRef(false)
  const [speaking, setFalando] = useState(false)
  const [alwaysAloud, setAlwaysAloud] = useState(
    () => localStorage.getItem('hippocampus.voice') === 'always')
  const speakAnswer = useRef<(text: string) => void>(() => {})
  const thread = useRef<HTMLDivElement>(null)
  const answerRef = useRef('')
  const { level: answerLevel, listenToAudio, pulseAlone, finish } = useAudioLevel()
  // Listening records and transcribes; its level is the one from your microphone.
  const listening = useListening((utterance) => { askedByVoice.current = true; send(utterance) }, t.common)
  const isListening = listening.state === 'listening'
  const level = isListening ? listening.level : answerLevel

  const { connected, send: sendToCore } = useSocket(api.socket, (data) => {
      if (data.tipo === 'thinking') { setThinking(true); setTool(''); setModel(''); setState('thinking') }
      // Which model jev chose for this request. Visible on purpose: automatic
      // routing nobody sees is routing nobody trusts.
      if (data.tipo === 'modelo') setModel(String(data.model).replace(/^claude-|-\d{8}$/g, ''))
      if (data.tipo === 'tool') {
        // The core only turns to water when it is genuinely reading the
        // database; the SDK's internal tool lookup is of no interest to anyone
        // watching.
        setTool(data.name)
        setState(data.name ? 'tool' : 'thinking')
      }
      // A piece of text arriving: write it at once, into its last message.
      if (data.tipo === 'delta') {
        answerRef.current += data.text
        setState('thinking')
        setMessages((atuais) => {
          const last = atuais[atuais.length - 1]
          if (last?.of === 'ele') {
            return [...atuais.slice(0, -1), { ...last, text: last.text + data.text }]
          }
          return [...atuais, { of: 'ele', text: data.text }]
        })
      }
      if (data.tipo === 'texto') {
        setState('thinking')
        answerRef.current = `${answerRef.current}\n${data.text}`.trim()
        setMessages((atuais) => {
          const last = atuais[atuais.length - 1]
          // Splices the pieces of one turn into a single message.
          if (last?.of === 'ele') {
            return [...atuais.slice(0, -1), { ...last, text: `${last.text}\n\n${data.text}`.trim() }]
          }
          return [...atuais, { of: 'ele', text: data.text }]
        })
      }
      if (data.tipo === 'fim') {
        setThinking(false)
        setTool('')
        const text = data.text || answerRef.current
        if (text && (askedByVoice.current || alwaysAloud)) speakAnswer.current(text)
        else setState('idle')
        askedByVoice.current = false
      }
      // The wake word toggles: speaking, it goes quiet; quiet, it starts listening.
      if (data.tipo === 'acordar') {
        if (speaking) voice.stop()
        else if (listening.state === 'idle' && !thinking) listening.toggle()
      }
      if (data.tipo === 'error') {
        setThinking(false)
        setState('error')
        setMessages((atuais) => [...atuais, { of: 'ele', text: data.error }])
        setTimeout(() => setState('idle'), 2600)
      }
  })

  useEffect(() => {
    thread.current?.scrollTo({ top: thread.current.scrollHeight, behavior: 'smooth' })
  }, [messages, thinking])

  useEffect(() => {
    if (listening.state === 'listening') setState('listening')
    else if (listening.state === 'transcribing') setState('thinking')
    else if (!thinking) setState('idle')
  }, [listening.state, thinking])

  const send = (question: string) => {
    const clear = question.trim()
    if (!clear || thinking) return
    if (!sendToCore({ tipo: 'pergunta', text: clear })) {
      // Never swallow the question quietly: the text stays in the field.
      setState('error')
      setMessages((atuais) => [...atuais, { of: 'ele', text: t.chat.coreIsDown }])
      setTimeout(() => setState('idle'), 2600)
      return
    }
    // Perguntar de novo cala o que estava sendo spoken.
    voice.stop()
    setMessages((atuais) => [...atuais, { of: 'eu', text: clear }])
    answerRef.current = ''
    setText('')
  }

  const voice = useSpeech({
    hasOwnVoice: Boolean(status?.voice),
    language,
    restOnScreen: t.common.restOnScreen,
    onStart: () => { setState('speaking'); setFalando(true) },
    onEnd: () => { setState('idle'); setFalando(false); finish() },
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

        {messages.map((fala_, index) => (
          <div key={index} className={`speech ${fala_.of === 'eu' ? 'minha' : 'dele'} aparece`}>
            {fala_.of === 'eu' ? fala_.text : <Markdown text={fala_.text} />}
            {fala_.of === 'ele' && (
              <button className="icon" onClick={() => speech(fala_.text)} title={t.chat.listen}
                style={{ marginTop: 6 }}>
                <IconSound />
              </button>
            )}
          </div>
        ))}

        {listening.error && (
          <div className="message theirs appear" style={{ color: 'var(--communication)' }}>
            {listening.error}
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
          className={`icone ${speaking ? 'speaking' : alwaysAloud ? 'ativo' : ''}`}
          onClick={() => {
            if (speaking) { voice.stop(); setFalando(false); return }
            const next = !alwaysAloud
            setAlwaysAloud(next)
            localStorage.setItem('hippocampus.voice', next ? 'always' : 'on-request')
          }}
          title={speaking ? t.chat.stopTalking
            : alwaysAloud ? t.chat.alwaysAloud
            : t.chat.aloudWhenYouSpeak}>
          {speaking ? <IconStop /> : alwaysAloud ? <IconSound /> : <IconMuted />}
        </button>
        <button
          className={`icone ${listening ? 'ativo' : ''}`}
          onClick={listening.toggle}
          disabled={listening.state === 'transcribing'}
          title={listening ? t.chat.stopListening : t.chat.speak}>
          <IconMicrophone />
        </button>
        <button className="icon" onClick={() => send(text)}
          disabled={!text.trim() || thinking || !connected} title={connected ? t.chat.send : t.chat.coreIsDown}>
          <IconSend />
        </button>
      </div>
    </div>
  )
}
