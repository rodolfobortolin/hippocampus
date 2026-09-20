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
  // de perguntar com a voice é esquisito. Digitou, fica em silêncio.
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
      // Qual model o jev escolheu para este pedido. Fica visível de propósito:
      // roteamento automático que ninguém vê é roteamento em que ninguém confia.
      if (data.tipo === 'modelo') setModel(String(data.model).replace(/^claude-|-\d{8}$/g, ''))
      if (data.tipo === 'tool') {
        // O núcleo só vira água quando ele está de fato lendo o banco; a search
        // interna de tool do SDK não interessa a quem está olhando.
        setTool(data.name)
        setState(data.name ? 'tool' : 'thinking')
      }
      // Pedaço de text chegando: escreve na hour, na última speech dele.
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
          // Emenda os pedaços do mesmo turno numa speech só.
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
      // A palavra de ativação toggle: speaking, cala; calado, começa a ouvir.
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
      // Nunca engolir a question em silêncio: o text fica no campo.
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
    <div className="conversa">
      <div className="fio" ref={thread}>
        {opening && (
          <div className="abertura">
            <Core state={state} level={level} size="large" />
            <h2>{t.chat.title} <b>{t.chat.titleStrong}</b>.</h2>
            <p>{t.chat.explanation}</p>
            <div className="atalhos-conversa">
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
              <button className="icone" onClick={() => speech(fala_.text)} title={t.chat.listen}
                style={{ marginTop: 6 }}>
                <IconSound />
              </button>
            )}
          </div>
        ))}

        {listening.error && (
          <div className="fala dele aparece" style={{ color: 'var(--communication)' }}>
            {listening.error}
          </div>
        )}

        {thinking && (
          <div className="ferramenta aparece">
            {tool ? `${t.chat.lookingUp} ${tool}…` : t.chat.thinking}
            {model && <span className="modelo">{model}</span>}
          </div>
        )}
      </div>

      <div className="compositor">
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
        {/* Enquanto speech, este botão cala. Parado, ele liga e desliga o modo
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
        <button className="icone" onClick={() => send(text)}
          disabled={!text.trim() || thinking || !connected} title={connected ? t.chat.send : t.chat.coreIsDown}>
          <IconSend />
        </button>
      </div>
    </div>
  )
}
