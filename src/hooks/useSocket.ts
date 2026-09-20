import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * A ligação com o núcleo, que se refaz sozinha.
 *
 * O núcleo reinicia — atualização, launchd, queda — e sem reconexão a conversa
 * morre calada: o envio vira nada e quem está olhando não sabe. Aqui a conexão
 * volta com wait crescente, e o state fica visível para a interface poder
 * dizer que está fora do ar em vez de engolir a question.
 */
export function useSocket(criar: () => WebSocket, aoReceber: (data: any) => void) {
  const [connected, setLigado] = useState(false)
  const socket = useRef<WebSocket | null>(null)
  const attempt = useRef(0)
  const vivo = useRef(true)
  const receive = useRef(aoReceber)
  receive.current = aoReceber

  const connect = useCallback(() => {
    if (!vivo.current) return
    let ws: WebSocket
    try {
      ws = criar()
    } catch {
      setLigado(false)
      return
    }
    socket.current = ws

    ws.onopen = () => { attempt.current = 0; setLigado(true) }
    ws.onmessage = (evento) => {
      try { receive.current(JSON.parse(evento.data)) } catch { /* frame inválido */ }
    }
    ws.onerror = () => ws.close()
    ws.onclose = () => {
      setLigado(false)
      if (!vivo.current) return
      // Espera crescente até 8s: o núcleo costuma voltar em poucos seconds.
      const wait = Math.min(8000, 400 * 2 ** attempt.current++)
      setTimeout(connect, wait)
    }
  }, [criar])

  useEffect(() => {
    vivo.current = true
    connect()
    return () => {
      vivo.current = false
      socket.current?.close()
    }
  }, [connect])

  const send = useCallback((data: unknown): boolean => {
    if (socket.current?.readyState !== WebSocket.OPEN) return false
    socket.current.send(JSON.stringify(data))
    return true
  }, [])

  return { connected, send }
}
