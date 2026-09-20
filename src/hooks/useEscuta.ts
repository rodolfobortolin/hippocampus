import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../lib/api.ts'

type Estado = 'parado' | 'ouvindo' | 'transcrevendo'

/**
 * Escuta por gravação, não pela API de voz do navegador.
 *
 * `webkitSpeechRecognition` existe no Electron mas não funciona: ela depende de
 * um serviço do Google para o qual só o Chrome tem credencial, então falha na
 * hora com erro de rede — o microfone acendia por um segundo e apagava. Aqui o
 * áudio é gravado, a fala é detectada pelo volume, e o trecho vai para a
 * transcrição quando você para de falar.
 */
export function useEscuta(aoOuvir: (texto: string) => void) {
  const [estado, setEstado] = useState<Estado>('parado')
  const [nivel, setNivel] = useState(0)
  const [erro, setErro] = useState('')

  const gravador = useRef<MediaRecorder | null>(null)
  const fluxo = useRef<MediaStream | null>(null)
  const contexto = useRef<AudioContext | null>(null)
  const quadro = useRef(0)
  const pedacos = useRef<Blob[]>([])
  const falou = useRef(false)
  const receber = useRef(aoOuvir)
  receber.current = aoOuvir

  const desmonta = useCallback(() => {
    cancelAnimationFrame(quadro.current)
    fluxo.current?.getTracks().forEach((faixa) => faixa.stop())
    fluxo.current = null
    void contexto.current?.close().catch(() => {})
    contexto.current = null
    setNivel(0)
  }, [])

  const parar = useCallback(() => {
    if (gravador.current?.state === 'recording') gravador.current.stop()
  }, [])

  const começar = useCallback(async () => {
    setErro('')
    try {
      const entrada = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      })
      fluxo.current = entrada

      const ac = new AudioContext()
      contexto.current = ac
      const analisador = ac.createAnalyser()
      analisador.fftSize = 512
      ac.createMediaStreamSource(entrada).connect(analisador)
      const dados = new Uint8Array(analisador.fftSize)

      const gravacao = new MediaRecorder(entrada, { mimeType: 'audio/webm' })
      gravador.current = gravacao
      pedacos.current = []
      falou.current = false
      gravacao.ondataavailable = (evento) => {
        if (evento.data.size) pedacos.current.push(evento.data)
      }

      gravacao.onstop = async () => {
        desmonta()
        const audio = new Blob(pedacos.current, { type: 'audio/webm' })
        // Trecho curto demais é clique sem fala; não vale uma chamada.
        if (!falou.current || audio.size < 4000) { setEstado('parado'); return }
        setEstado('transcrevendo')
        try {
          const texto = await api.transcrever(audio)
          setEstado('parado')
          if (texto) receber.current(texto)
          else setErro('Não entendi o que você falou.')
        } catch (falha) {
          setEstado('parado')
          setErro((falha as Error).message)
        }
      }

      let silencioDesde = 0
      const acompanha = () => {
        analisador.getByteTimeDomainData(dados)
        let soma = 0
        for (const amostra of dados) soma += ((amostra - 128) / 128) ** 2
        const volume = Math.min(1, Math.sqrt(soma / dados.length) * 5)
        setNivel(volume)

        const agora = performance.now()
        if (volume > 0.08) {
          falou.current = true
          silencioDesde = 0
        } else if (falou.current) {
          if (!silencioDesde) silencioDesde = agora
          // Um segundo e meio de silêncio depois de falar encerra o trecho.
          else if (agora - silencioDesde > 1500) { parar(); return }
        }
        quadro.current = requestAnimationFrame(acompanha)
      }

      gravacao.start()
      setEstado('ouvindo')
      acompanha()
    } catch (falha) {
      desmonta()
      setEstado('parado')
      setErro(
        (falha as Error).name === 'NotAllowedError'
          ? 'O microfone foi negado. Autorize em Ajustes → Privacidade → Microfone.'
          : (falha as Error).message,
      )
    }
  }, [desmonta, parar])

  const alterna = useCallback(() => {
    if (estado === 'ouvindo') parar()
    else if (estado === 'parado') void começar()
  }, [estado, parar, começar])

  useEffect(() => () => { parar(); desmonta() }, [parar, desmonta])

  return { estado, nivel, erro, alterna, limpaErro: () => setErro('') }
}
