import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * A ligação com o núcleo, que se refaz sozinha.
 *
 * O núcleo reinicia — atualização, launchd, queda — e sem reconexão a conversa
 * morre calada: o envio vira nada e quem está olhando não sabe. Aqui a conexão
 * volta com espera crescente, e o estado fica visível para a interface poder
 * dizer que está fora do ar em vez de engolir a pergunta.
 */
export function useSocket(criar: () => WebSocket, aoReceber: (dados: any) => void) {
  const [ligado, setLigado] = useState(false)
  const socket = useRef<WebSocket | null>(null)
  const tentativa = useRef(0)
  const vivo = useRef(true)
  const receber = useRef(aoReceber)
  receber.current = aoReceber

  const conecta = useCallback(() => {
    if (!vivo.current) return
    let ws: WebSocket
    try {
      ws = criar()
    } catch {
      setLigado(false)
      return
    }
    socket.current = ws

    ws.onopen = () => { tentativa.current = 0; setLigado(true) }
    ws.onmessage = (evento) => {
      try { receber.current(JSON.parse(evento.data)) } catch { /* quadro inválido */ }
    }
    ws.onerror = () => ws.close()
    ws.onclose = () => {
      setLigado(false)
      if (!vivo.current) return
      // Espera crescente até 8s: o núcleo costuma voltar em poucos segundos.
      const espera = Math.min(8000, 400 * 2 ** tentativa.current++)
      setTimeout(conecta, espera)
    }
  }, [criar])

  useEffect(() => {
    vivo.current = true
    conecta()
    return () => {
      vivo.current = false
      socket.current?.close()
    }
  }, [conecta])

  const envia = useCallback((dados: unknown): boolean => {
    if (socket.current?.readyState !== WebSocket.OPEN) return false
    socket.current.send(JSON.stringify(dados))
    return true
  }, [])

  return { ligado, envia }
}
