import { useEffect, useRef, useState } from 'react'
import { api, type Status } from '../lib/api.ts'
import { Markdown } from '../lib/markdown.tsx'
import { useNivelAudio } from '../hooks/useNivelAudio.ts'
import { useEscuta } from '../hooks/useEscuta.ts'
import { useSocket } from '../hooks/useSocket.ts'
import { useFala } from '../hooks/useFala.ts'
import { Nucleo, type EstadoNucleo } from './Nucleo.tsx'
import { IconeEnviar, IconeMicrofone, IconeSom, IconeMudo, IconeParar } from './Icons.tsx'
import { VELOCIDADE_DA_FALA } from '../lib/format.ts'

type Fala = { de: 'eu' | 'ele'; texto: string }

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
  const [estado, setEstado] = useState<EstadoNucleo>('parado')
  // Se a pergunta veio falada, a resposta volta falada — esperar texto depois
  // de perguntar com a voz é esquisito. Digitou, fica em silêncio.
  const perguntouFalando = useRef(false)
  const [falando, setFalando] = useState(false)
  const [vozSempre, setVozSempre] = useState(
    () => localStorage.getItem('hipocampo.voz') === 'sempre')
  const falarResposta = useRef<(texto: string) => void>(() => {})
  const fio = useRef<HTMLDivElement>(null)
  const respostaRef = useRef('')
  const { nivel: nivelResposta, ouveAudio, pulsaSozinho, encerra } = useNivelAudio()
  // A escuta grava e transcreve; o nível dela é o do seu microfone.
  const escuta = useEscuta((frase) => { perguntouFalando.current = true; envia(frase) })
  const ouvindo = escuta.estado === 'ouvindo'
  const nivel = ouvindo ? escuta.nivel : nivelResposta

  const { ligado, envia: mandaAoNucleo } = useSocket(api.socket, (dados) => {
      if (dados.tipo === 'pensando') { setPensando(true); setFerramenta(''); setEstado('pensando') }
      if (dados.tipo === 'ferramenta') {
        // O núcleo só vira água quando ele está de fato lendo o banco; a busca
        // interna de ferramenta do SDK não interessa a quem está olhando.
        setFerramenta(dados.nome)
        setEstado(dados.nome ? 'ferramenta' : 'pensando')
      }
      if (dados.tipo === 'texto') {
        setEstado('pensando')
        respostaRef.current = `${respostaRef.current}\n${dados.texto}`.trim()
        setFalas((atuais) => {
          const ultima = atuais[atuais.length - 1]
          // Emenda os pedaços do mesmo turno numa fala só.
          if (ultima?.de === 'ele') {
            return [...atuais.slice(0, -1), { ...ultima, texto: `${ultima.texto}\n\n${dados.texto}`.trim() }]
          }
          return [...atuais, { de: 'ele', texto: dados.texto }]
        })
      }
      if (dados.tipo === 'fim') {
        setPensando(false)
        setFerramenta('')
        const texto = dados.texto || respostaRef.current
        if (texto && (perguntouFalando.current || vozSempre)) falarResposta.current(texto)
        else setEstado('parado')
        perguntouFalando.current = false
      }
      if (dados.tipo === 'erro') {
        setPensando(false)
        setEstado('erro')
        setFalas((atuais) => [...atuais, { de: 'ele', texto: `Deu problema: ${dados.erro}` }])
        setTimeout(() => setEstado('parado'), 2600)
      }
  })

  useEffect(() => {
    fio.current?.scrollTo({ top: fio.current.scrollHeight, behavior: 'smooth' })
  }, [falas, pensando])

  useEffect(() => {
    if (escuta.estado === 'ouvindo') setEstado('ouvindo')
    else if (escuta.estado === 'transcrevendo') setEstado('pensando')
    else if (!pensando) setEstado('parado')
  }, [escuta.estado, pensando])

  const envia = (pergunta: string) => {
    const limpa = pergunta.trim()
    if (!limpa || pensando) return
    if (!mandaAoNucleo({ tipo: 'pergunta', texto: limpa })) {
      // Nunca engolir a pergunta em silêncio: o texto fica no campo.
      setEstado('erro')
      setFalas((atuais) => [...atuais, {
        de: 'ele', texto: 'O núcleo está fora do ar. Assim que ele voltar, mande de novo.',
      }])
      setTimeout(() => setEstado('parado'), 2600)
      return
    }
    // Perguntar de novo cala o que estava sendo dito.
    voz.parar()
    setFalas((atuais) => [...atuais, { de: 'eu', texto: limpa }])
    respostaRef.current = ''
    setTexto('')
  }

  const voz = useFala({
    temVozPropria: Boolean(status?.voz),
    aoComecar: () => { setEstado('falando'); setFalando(true) },
    aoTerminar: () => { setEstado('parado'); setFalando(false); encerra() },
    aoOuvirAudio: ouveAudio,
    aoPulsar: pulsaSozinho,
  })
  const fala = voz.falar
  falarResposta.current = voz.falar
  const abertura = !falas.length

  return (
    <div className="conversa">
      <div className="fio" ref={fio}>
        {abertura && (
          <div className="abertura">
            <Nucleo estado={estado} nivel={nivel} tamanho="grande" />
            <h2>
              Pergunte sobre <b>o seu dia</b>.
            </h2>
            <p>
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

        {escuta.erro && (
          <div className="fala dele aparece" style={{ color: 'var(--comunicacao)' }}>
            {escuta.erro}
          </div>
        )}

        {pensando && (
          <div className="ferramenta aparece">
            {ferramenta ? `consultando ${ferramenta}…` : 'pensando…'}
          </div>
        )}
      </div>

      <div className="compositor">
        {!abertura && <Nucleo estado={estado} nivel={nivel} tamanho="pequeno" />}
        <textarea
          value={texto}
          onChange={(evento) => setTexto(evento.target.value)}
          onKeyDown={(evento) => {
            if (evento.key === 'Enter' && !evento.shiftKey) { evento.preventDefault(); envia(texto) }
          }}
          placeholder={
            !ligado ? 'reconectando ao núcleo…'
              : ouvindo ? 'ouvindo… pare de falar que eu envio'
              : escuta.estado === 'transcrevendo' ? 'transcrevendo…'
              : 'pergunte qualquer coisa sobre o seu tempo'
          }
          rows={1}
          style={{ height: Math.min(160, 24 + texto.split('\n').length * 20) }}
        />
        {/* Enquanto fala, este botão cala. Parado, ele liga e desliga o modo
            de responder sempre falando. */}
        <button
          className={`icone ${falando ? 'falando' : vozSempre ? 'ativo' : ''}`}
          onClick={() => {
            if (falando) { voz.parar(); setFalando(false); return }
            const proximo = !vozSempre
            setVozSempre(proximo)
            localStorage.setItem('hipocampo.voz', proximo ? 'sempre' : 'pedido')
          }}
          title={falando ? 'parar de falar'
            : vozSempre ? 'responder sempre falando'
            : 'responder falando só quando você falar'}>
          {falando ? <IconeParar /> : vozSempre ? <IconeSom /> : <IconeMudo />}
        </button>
        <button
          className={`icone ${ouvindo ? 'ativo' : ''}`}
          onClick={escuta.alterna}
          disabled={escuta.estado === 'transcrevendo'}
          title={ouvindo ? 'parar de ouvir' : 'falar'}>
          <IconeMicrofone />
        </button>
        <button className="icone" onClick={() => envia(texto)}
          disabled={!texto.trim() || pensando || !ligado} title={ligado ? 'enviar' : 'núcleo fora do ar'}>
          <IconeEnviar />
        </button>
      </div>
    </div>
  )
}
