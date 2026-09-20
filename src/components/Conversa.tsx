import { useEffect, useRef, useState } from 'react'
import { api, type Status } from '../lib/api.ts'
import { Markdown } from '../lib/markdown.tsx'
import { IconeEnviar, IconeMicrofone, IconeSom } from './Icons.tsx'

type Fala = { de: 'eu' | 'ele'; texto: string; ferramentas?: string[] }

const SUGESTOES = [
  'Me dá um recap divertido do meu histórico: padrão de trabalho, distrações, atalhos favoritos, meu estilo de escrita e uma zoeira leve',
  'Onde foi meu tempo essa semana?',
  'Em que projeto eu mais trabalhei nos últimos 30 dias?',
  'Qual foi minha maior distração ontem?',
  'A que horas eu rendo mais?',
]

export function Conversa({ status }: { status: Status | null }) {
  const [falas, setFalas] = useState<Fala[]>([])
  const [texto, setTexto] = useState('')
  const [pensando, setPensando] = useState(false)
  const [ferramenta, setFerramenta] = useState('')
  const [ouvindo, setOuvindo] = useState(false)
  const socket = useRef<WebSocket | null>(null)
  const fio = useRef<HTMLDivElement>(null)
  const reconhecimento = useRef<any>(null)

  useEffect(() => {
    const ws = api.socket()
    socket.current = ws
    ws.onmessage = (evento) => {
      const dados = JSON.parse(evento.data)
      if (dados.tipo === 'pensando') { setPensando(true); setFerramenta('') }
      if (dados.tipo === 'ferramenta') setFerramenta(dados.nome)
      if (dados.tipo === 'texto') {
        setFalas((atuais) => {
          const ultima = atuais[atuais.length - 1]
          // Emenda os pedaços do mesmo turno numa fala só.
          if (ultima?.de === 'ele') {
            return [...atuais.slice(0, -1), { ...ultima, texto: `${ultima.texto}\n\n${dados.texto}`.trim() }]
          }
          return [...atuais, { de: 'ele', texto: dados.texto }]
        })
      }
      if (dados.tipo === 'fim') { setPensando(false); setFerramenta('') }
      if (dados.tipo === 'erro') {
        setPensando(false)
        setFalas((atuais) => [...atuais, { de: 'ele', texto: `Deu problema: ${dados.erro}` }])
      }
    }
    return () => ws.close()
  }, [])

  useEffect(() => {
    fio.current?.scrollTo({ top: fio.current.scrollHeight, behavior: 'smooth' })
  }, [falas, pensando])

  const envia = (pergunta: string) => {
    const limpa = pergunta.trim()
    if (!limpa || pensando || socket.current?.readyState !== WebSocket.OPEN) return
    setFalas((atuais) => [...atuais, { de: 'eu', texto: limpa }])
    socket.current.send(JSON.stringify({ tipo: 'pergunta', texto: limpa }))
    setTexto('')
  }

  const escuta = () => {
    const Motor = (window as any).webkitSpeechRecognition ?? (window as any).SpeechRecognition
    if (!Motor) return
    if (ouvindo) { reconhecimento.current?.stop(); setOuvindo(false); return }

    const motor = new Motor()
    motor.lang = 'pt-BR'
    motor.interimResults = true
    motor.continuous = false
    motor.onresult = (evento: any) => {
      const frase = Array.from(evento.results).map((r: any) => r[0].transcript).join('')
      setTexto(frase)
      if (evento.results[evento.results.length - 1].isFinal) { setOuvindo(false); envia(frase) }
    }
    motor.onerror = () => setOuvindo(false)
    motor.onend = () => setOuvindo(false)
    motor.start()
    reconhecimento.current = motor
    setOuvindo(true)
  }

  const fala = async (conteudo: string) => {
    if (!status?.voz) {
      // Sem chave da OpenAI, a voz do próprio macOS resolve.
      const frase = new SpeechSynthesisUtterance(conteudo.replace(/[*#`]/g, ''))
      frase.lang = 'pt-BR'
      speechSynthesis.speak(frase)
      return
    }
    const resposta = await api.voz(conteudo.replace(/[*#`]/g, ''))
    if (!resposta.ok) return
    const audio = new Audio(URL.createObjectURL(await resposta.blob()))
    void audio.play()
  }

  return (
    <div className="conversa">
      <div className="fio" ref={fio}>
        {!falas.length && (
          <div style={{ paddingTop: 30 }}>
            <h2 style={{ fontSize: 25, fontWeight: 300, letterSpacing: '-0.5px', marginBottom: 8 }}>
              Pergunte sobre <b style={{ fontWeight: 600 }}>o seu dia</b>.
            </h2>
            <p style={{ color: 'var(--texto-fraco)', fontSize: 13, marginBottom: 22, maxWidth: '62ch' }}>
              Eu consulto o que foi medido nesta máquina — tempo por app e janela, projetos,
              commits, sites, atalhos, o que você digitou e o que pediu ao Claude Code.
              Nada disso sai daqui.
            </p>
            <div className="atalhos-conversa">
              {SUGESTOES.map((sugestao) => (
                <button key={sugestao} onClick={() => envia(sugestao)}>
                  {sugestao.length > 58 ? `${sugestao.slice(0, 56)}…` : sugestao}
                </button>
              ))}
            </div>
          </div>
        )}

        {falas.map((fala_, indice) => (
          <div key={indice} className={`fala ${fala_.de === 'eu' ? 'minha' : 'dele'} aparece`}>
            {fala_.de === 'eu' ? fala_.texto : <Markdown texto={fala_.texto} />}
            {fala_.de === 'ele' && (
              <button className="icone" onClick={() => fala(fala_.texto)} title="ouvir"
                style={{ marginTop: 6 }}>
                <IconeSom />
              </button>
            )}
          </div>
        ))}

        {pensando && (
          <div className="ferramenta aparece">
            {ferramenta ? `consultando ${ferramenta}…` : 'pensando…'}
          </div>
        )}
      </div>

      <div className="compositor">
        <textarea
          value={texto}
          onChange={(evento) => setTexto(evento.target.value)}
          onKeyDown={(evento) => {
            if (evento.key === 'Enter' && !evento.shiftKey) { evento.preventDefault(); envia(texto) }
          }}
          placeholder={ouvindo ? 'ouvindo…' : 'pergunte qualquer coisa sobre o seu tempo'}
          rows={1}
          style={{ height: Math.min(160, 24 + texto.split('\n').length * 20) }}
        />
        <button className={`icone ${ouvindo ? 'ativo' : ''}`} onClick={escuta} title="falar">
          <IconeMicrofone />
        </button>
        <button className="icone" onClick={() => envia(texto)} disabled={!texto.trim() || pensando} title="enviar">
          <IconeEnviar />
        </button>
      </div>
    </div>
  )
}
