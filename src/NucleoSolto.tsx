import { useEffect, useRef, useState } from 'react'
import { api, type Status } from './lib/api.ts'
import { Nucleo, type EstadoNucleo } from './components/Nucleo.tsx'
import { useEscuta } from './hooks/useEscuta.ts'
import { useNivelAudio } from './hooks/useNivelAudio.ts'
import { useSocket } from './hooks/useSocket.ts'
import { useFala } from './hooks/useFala.ts'
import { VELOCIDADE_DA_FALA } from './lib/format.ts'

/**
 * O núcleo solto: uma janela sem moldura com a esfera e nada mais.
 *
 * É o app quando você não quer o app — fica por cima do que você estiver
 * fazendo, escuta com um clique e responde falando. O texto aparece só o
 * suficiente para conferir; quem quiser ler tudo abre o painel.
 */
export function NucleoSolto() {
  const [estado, setEstado] = useState<EstadoNucleo>('parado')
  const [resposta, setResposta] = useState('')
  const [pergunta, setPergunta] = useState('')
  const [status, setStatus] = useState<Status | null>(null)
  const { nivel: nivelResposta, ouveAudio, pulsaSozinho, encerra } = useNivelAudio()

  const respostaRef = useRef('')
  const falaResposta = useRef<(texto: string) => void>(() => {})

  const { ligado, envia } = useSocket(api.socket, (dados) => {
    if (dados.tipo === 'pensando') { setEstado('pensando'); setResposta('') }
    if (dados.tipo === 'ferramenta') setEstado(dados.nome ? 'ferramenta' : 'pensando')
    if (dados.tipo === 'texto') {
      respostaRef.current = `${respostaRef.current}\n${dados.texto}`.trim()
      setResposta(respostaRef.current)
    }
    if (dados.tipo === 'fim') {
      const texto = dados.texto || respostaRef.current
      setResposta(texto)
      falaResposta.current(texto)
    }
    if (dados.tipo === 'erro') { setEstado('erro'); setResposta(dados.erro) }
  })

  const escuta = useEscuta((frase) => {
    setPergunta(frase)
    respostaRef.current = ''
    envia({ tipo: 'pergunta', texto: frase })
  })

  useEffect(() => { api.status().then(setStatus).catch(() => {}) }, [])

  // Aqui não há tela para ler: a voz é a saída principal, e clicar na esfera
  // enquanto ela fala manda calar.
  const voz = useFala({
    temVozPropria: Boolean(status?.voz),
    aoComecar: () => setEstado('falando'),
    aoTerminar: () => { setEstado('parado'); encerra() },
    aoOuvirAudio: ouveAudio,
    aoPulsar: pulsaSozinho,
  })
  falaResposta.current = voz.falar

  useEffect(() => {
    if (escuta.estado === 'ouvindo') setEstado('ouvindo')
    else if (escuta.estado === 'transcrevendo') setEstado('pensando')
  }, [escuta.estado])

  const ouvindo = escuta.estado === 'ouvindo'
  const legenda = escuta.erro || resposta || pergunta ||
    (ligado ? 'clique para falar' : 'reconectando…')

  return (
    <div className="solto">
      <button
        className="solto-orbe"
        onClick={() => { if (estado === 'falando') voz.parar(); else escuta.alterna() }}
        title={estado === 'falando' ? 'calar' : ouvindo ? 'parar de ouvir' : 'falar com o Hipocampo'}>
        <Nucleo estado={estado} nivel={ouvindo ? escuta.nivel : nivelResposta} tamanho="grande" />
      </button>

      <div className={`solto-legenda ${resposta ? 'longa' : ''}`}>
        {pergunta && resposta && <b>{pergunta}</b>}
        <p>{legenda}</p>
      </div>
    </div>
  )
}
