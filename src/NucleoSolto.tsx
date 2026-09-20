import { useEffect, useRef, useState } from 'react'
import { api, type Status } from './lib/api.ts'
import { Nucleo, type EstadoNucleo } from './components/Nucleo.tsx'
import { useEscuta } from './hooks/useEscuta.ts'
import { useNivelAudio } from './hooks/useNivelAudio.ts'
import { useSocket } from './hooks/useSocket.ts'
import { useFala } from './hooks/useFala.ts'
import { useIdioma } from './lib/idioma.tsx'

/** A ponte do Electron. No navegador ela não existe, e o arrasto some junto. */
const ponte = (globalThis as any).hipocampo as {
  moveNucleo?: (dx: number, dy: number) => void
  fixaNucleo?: () => void
  aoAcordar?: (callback: () => void) => () => void
} | undefined

/**
 * O núcleo solto: uma janela sem moldura com a esfera e nada mais.
 *
 * É o app quando você não quer o app — fica por cima do que você estiver
 * fazendo, escuta com um clique e responde falando. O texto aparece só o
 * suficiente para conferir; quem quiser ler tudo abre o painel.
 *
 * Arrastar a esfera move a janela e a posição fica guardada. O arrasto é feito
 * à mão, e não com `-webkit-app-region`, porque essa propriedade engole o
 * clique — e o clique é como se fala com ele.
 */
export function NucleoSolto() {
  const { t, idioma } = useIdioma()
  const [estado, setEstado] = useState<EstadoNucleo>('parado')
  const [resposta, setResposta] = useState('')
  const [pergunta, setPergunta] = useState('')
  const [status, setStatus] = useState<Status | null>(null)
  const { nivel: nivelResposta, ouveAudio, pulsaSozinho, encerra } = useNivelAudio()

  const respostaRef = useRef('')
  const falaResposta = useRef<(texto: string) => void>(() => {})
  const arrastou = useRef(false)

  const { ligado, envia } = useSocket(api.socket, (dados) => {
    if (dados.tipo === 'pensando') { setEstado('pensando'); setResposta('') }
    if (dados.tipo === 'ferramenta') setEstado(dados.nome ? 'ferramenta' : 'pensando')
    if (dados.tipo === 'delta') {
      respostaRef.current += dados.texto
      setResposta(respostaRef.current)
    }
    if (dados.tipo === 'texto') {
      respostaRef.current = `${respostaRef.current}\n${dados.texto}`.trim()
      setResposta(respostaRef.current)
    }
    if (dados.tipo === 'fim') {
      const texto = dados.texto || respostaRef.current
      setResposta(texto)
      falaResposta.current(texto)
    }
    if (dados.tipo === 'acordar') acorda()
    if (dados.tipo === 'erro') { setEstado('erro'); setResposta(dados.erro) }
  })

  const escuta = useEscuta((frase) => {
    setPergunta(frase)
    respostaRef.current = ''
    envia({ tipo: 'pergunta', texto: frase })
  }, t.comum)

  /** Falando, cala. Calado, começa a ouvir. É o mesmo gesto do clique. */
  const acorda = () => {
    if (estado === 'falando') voz.parar()
    else if (escuta.estado === 'parado') escuta.alterna()
  }
  const acordaRef = useRef(acorda)
  acordaRef.current = acorda

  useEffect(() => { api.status().then(setStatus).catch(() => {}) }, [])

  // A palavra de ativação e o atalho chegam pelo Electron: ele traz a janela
  // para a frente e avisa aqui, porque a janela pode ter acabado de nascer e
  // ter perdido o aviso que passou pelo socket.
  useEffect(() => ponte?.aoAcordar?.(() => acordaRef.current()), [])

  // Aqui não há tela para ler: a voz é a saída principal, e clicar na esfera
  // enquanto ela fala manda calar.
  const voz = useFala({
    temVozPropria: Boolean(status?.voz),
    idioma,
    restoNaTela: t.comum.restoNaTela,
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

  const comecaArrasto = (evento: React.PointerEvent<HTMLButtonElement>) => {
    if (!ponte?.moveNucleo) return
    arrastou.current = false
    let ultimoX = evento.screenX
    let ultimoY = evento.screenY
    let andou = 0

    const move = (e: PointerEvent) => {
      const dx = e.screenX - ultimoX
      const dy = e.screenY - ultimoY
      andou += Math.abs(dx) + Math.abs(dy)
      ultimoX = e.screenX
      ultimoY = e.screenY
      // Um tremor de três pixels ao clicar não é arrasto; acima disso é.
      if (andou > 4) {
        arrastou.current = true
        ponte.moveNucleo?.(dx, dy)
      }
    }
    const solta = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', solta)
      if (arrastou.current) ponte.fixaNucleo?.()
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', solta)
  }

  const ouvindo = escuta.estado === 'ouvindo'
  const legenda = escuta.erro || resposta || pergunta ||
    (ligado ? t.conversa.cliqueParaFalar : t.conversa.reconectando)

  return (
    <div className="solto">
      <button
        className="solto-orbe"
        onPointerDown={comecaArrasto}
        onClick={() => {
          // O clique que fecha um arrasto não é um pedido de conversa.
          if (arrastou.current) { arrastou.current = false; return }
          if (estado === 'falando') voz.parar()
          else escuta.alterna()
        }}
        title={estado === 'falando' ? t.conversa.calar
          : ouvindo ? t.conversa.pararDeOuvir
          : t.conversa.falar}>
        <Nucleo estado={estado} nivel={ouvindo ? escuta.nivel : nivelResposta} tamanho="solto" />
      </button>

      <div className={`solto-legenda ${resposta ? 'longa' : ''}`}>
        {pergunta && resposta && <b>{pergunta}</b>}
        <p>{legenda}</p>
      </div>
    </div>
  )
}
