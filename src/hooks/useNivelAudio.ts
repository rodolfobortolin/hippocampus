import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * O volume de quem está falando agora, de 0 a 1 — o seu pelo microfone, o dele
 * pelo áudio da resposta. É o que faz o núcleo se mexer junto com a voz.
 */
export function useNivelAudio() {
  const [nivel, setNivel] = useState(0)
  const contexto = useRef<AudioContext | null>(null)
  const parar = useRef<(() => void) | null>(null)
  // Um elemento de áudio só pode virar fonte uma vez por contexto.
  const fontes = useRef(new WeakMap<HTMLMediaElement, MediaElementAudioSourceNode>())

  const garanteContexto = () => {
    if (!contexto.current || contexto.current.state === 'closed') {
      contexto.current = new AudioContext()
    }
    void contexto.current.resume()
    return contexto.current
  }

  const mede = (analisador: AnalyserNode, aoFim?: () => void) => {
    const dados = new Uint8Array(analisador.fftSize)
    let quadro = 0
    const passo = () => {
      analisador.getByteTimeDomainData(dados)
      let soma = 0
      for (const amostra of dados) soma += ((amostra - 128) / 128) ** 2
      setNivel(Math.min(1, Math.sqrt(soma / dados.length) * 5))
      quadro = requestAnimationFrame(passo)
    }
    passo()
    return () => {
      cancelAnimationFrame(quadro)
      setNivel(0)
      aoFim?.()
    }
  }

  const encerra = useCallback(() => {
    parar.current?.()
    parar.current = null
  }, [])

  const ouveMicrofone = useCallback(async () => {
    encerra()
    try {
      const fluxo = await navigator.mediaDevices.getUserMedia({ audio: true })
      const ac = garanteContexto()
      const analisador = ac.createAnalyser()
      analisador.fftSize = 512
      ac.createMediaStreamSource(fluxo).connect(analisador)
      parar.current = mede(analisador, () => fluxo.getTracks().forEach((t) => t.stop()))
    } catch {
      // Sem microfone o núcleo ainda muda de estado; só não pulsa junto.
    }
  }, [encerra])

  const ouveAudio = useCallback((audio: HTMLAudioElement) => {
    encerra()
    try {
      const ac = garanteContexto()
      let fonte = fontes.current.get(audio)
      if (!fonte) {
        fonte = ac.createMediaElementSource(audio)
        fontes.current.set(audio, fonte)
      }
      const analisador = ac.createAnalyser()
      analisador.fftSize = 512
      fonte.connect(analisador)
      // Sem isto o áudio entra no grafo e nunca chega no alto-falante.
      fonte.connect(ac.destination)
      parar.current = mede(analisador)
    } catch {
      // Se o navegador recusar, cai no pulso sintético.
    }
  }, [encerra])

  /** Quando não há áudio para analisar (voz do sistema), um pulso convincente. */
  const pulsaSozinho = useCallback(() => {
    encerra()
    let quadro = 0
    let fase = Math.random() * 10
    const passo = () => {
      fase += 0.09
      const onda = 0.34 + Math.sin(fase * 2.3) * 0.16 + Math.sin(fase * 5.7) * 0.1
      setNivel(Math.max(0, Math.min(1, onda)))
      quadro = requestAnimationFrame(passo)
    }
    passo()
    parar.current = () => { cancelAnimationFrame(quadro); setNivel(0) }
  }, [encerra])

  useEffect(() => () => {
    parar.current?.()
    void contexto.current?.close()
  }, [])

  return { nivel, ouveMicrofone, ouveAudio, pulsaSozinho, encerra }
}
