import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * The link to the core, which repairs itself.
 *
 * The core restarts — an update, launchd, a crash — and without reconnection the
 * chat dies quietly: the send turns into nothing and whoever is looking has no
 * idea. Here the connection comes back with a growing wait, and the state stays
 * visible so the interface can say it is down instead of swallowing the question.
 */
export function useSocket(criar: () => WebSocket, aoReceber: (data: any) => void) {
  const [connected, setLigado] = useState(false)
  const socket = useRef<WebSocket | null>(null)
  const attempt = useRef(0)
  const alive = useRef(true)
  const receive = useRef(aoReceber)
  receive.current = aoReceber

  const connect = useCallback(() => {
    if (!alive.current) return
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
      try { receive.current(JSON.parse(evento.data)) } catch { /* an invalid frame */ }
    }
    ws.onerror = () => ws.close()
    ws.onclose = () => {
      setLigado(false)
      if (!alive.current) return
      // A growing wait up to 8s: the core usually comes back in a few seconds.
      const wait = Math.min(8000, 400 * 2 ** attempt.current++)
      setTimeout(connect, wait)
    }
  }, [criar])

  useEffect(() => {
    alive.current = true
    connect()
    return () => {
      alive.current = false
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
