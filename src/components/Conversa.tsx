import { useEffect, useRef, useState } from 'react'
import { api, type Status } from '../lib/api.ts'
import { Markdown } from '../lib/markdown.tsx'
import { useNivelAudio } from '../hooks/useNivelAudio.ts'
import { useEscuta } from '../hooks/useEscuta.ts'
import { useSocket } from '../hooks/useSocket.ts'
import { useFala } from '../hooks/useFala.ts'
import { Nucleo, type EstadoNucleo } from './Nucleo.tsx'
import { IconeEnviar, IconeMicrofone, IconeSom, IconeMudo, IconeParar } from './Icons.tsx'
import { useIdioma } from '../lib/idioma.tsx'

type Fala = { de: 'eu' | 'ele'; texto: string }

export function Conversa({ status }: { status: Status | null }) {
  const { t, idioma } = useIdioma()
  const [falas, setFalas] = useState<Fala[]>([])
  const [texto, setTexto] = useState('')
  const [pensando, setPensando] = useState(false)
  const [ferramenta, setFerramenta] = useState('')
  const [modelo, setModelo] = useState('')
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
  const escuta = useEscuta((frase) => { perguntouFalando.current = true; envia(frase) }, t.comum)
  const ouvindo = escuta.estado === 'ouvindo'
  const nivel = ouvindo ? escuta.nivel : nivelResposta

  const { ligado, envia: mandaAoNucleo } = useSocket(api.socket, (dados) => {
      if (dados.tipo === 'pensando') { setPensando(true); setFerramenta(''); setModelo(''); setEstado('pensando') }
      // Qual modelo o jev escolheu para este pedido. Fica visível de propósito:
      // roteamento automático que ninguém vê é roteamento em que ninguém confia.
      if (dados.tipo === 'modelo') setModelo(String(dados.modelo).replace(/^claude-|-\d{8}$/g, ''))
      if (dados.tipo === 'ferramenta') {
        // O núcleo só vira água quando ele está de fato lendo o banco; a busca
        // interna de ferramenta do SDK não interessa a quem está olhando.
        setFerramenta(dados.nome)
        setEstado(dados.nome ? 'ferramenta' : 'pensando')
      }
      // Pedaço de texto chegando: escreve na hora, na última fala dele.
      if (dados.tipo === 'delta') {
        respostaRef.current += dados.texto
        setEstado('pensando')
        setFalas((atuais) => {
          const ultima = atuais[atuais.length - 1]
          if (ultima?.de === 'ele') {
            return [...atuais.slice(0, -1), { ...ultima, texto: ultima.texto + dados.texto }]
          }
          return [...atuais, { de: 'ele', texto: dados.texto }]
        })
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
      // A palavra de ativação alterna: falando, cala; calado, começa a ouvir.
      if (dados.tipo === 'acordar') {
        if (falando) voz.parar()
        else if (escuta.estado === 'parado' && !pensando) escuta.alterna()
      }
      if (dados.tipo === 'erro') {
        setPensando(false)
        setEstado('erro')
        setFalas((atuais) => [...atuais, { de: 'ele', texto: dados.erro }])
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
      setFalas((atuais) => [...atuais, { de: 'ele', texto: t.conversa.nucleoFora }])
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
    idioma,
    restoNaTela: t.comum.restoNaTela,
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
            <h2>{t.conversa.titulo} <b>{t.conversa.tituloForte}</b>.</h2>
            <p>{t.conversa.explicacao}</p>
            <div className="atalhos-conversa">
              {t.conversa.sugestoes.map((sugestao) => (
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
              <button className="icone" onClick={() => fala(fala_.texto)} title={t.conversa.ouvir}
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
            {ferramenta ? `${t.conversa.consultando} ${ferramenta}…` : t.conversa.pensando}
            {modelo && <span className="modelo">{modelo}</span>}
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
            !ligado ? t.conversa.reconectando
              : ouvindo ? t.conversa.ouvindo
              : escuta.estado === 'transcrevendo' ? t.conversa.transcrevendo
              : t.conversa.placeholder
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
          title={falando ? t.conversa.calar
            : vozSempre ? t.conversa.vozSempre
            : t.conversa.vozQuandoFalar}>
          {falando ? <IconeParar /> : vozSempre ? <IconeSom /> : <IconeMudo />}
        </button>
        <button
          className={`icone ${ouvindo ? 'ativo' : ''}`}
          onClick={escuta.alterna}
          disabled={escuta.estado === 'transcrevendo'}
          title={ouvindo ? t.conversa.pararDeOuvir : t.conversa.falar}>
          <IconeMicrofone />
        </button>
        <button className="icone" onClick={() => envia(texto)}
          disabled={!texto.trim() || pensando || !ligado} title={ligado ? t.conversa.enviar : t.conversa.nucleoFora}>
          <IconeEnviar />
        </button>
      </div>
    </div>
  )
}
