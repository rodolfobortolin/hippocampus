import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * The link to the core, which repairs itself.
 *
 * The core restarts — an update, launchd, a crash — and without reconnection
 * the chat dies quietly: the send turns into nothing and whoever is looking has
 * no idea. Here the connection comes back with a growing wait, and the state
 * stays visible so the interface can say it is down instead of swallowing the
 * question.
 *
 * Exactly one connection at a time, which takes some care. `close()` is not
 * immediate: a socket closed on the way out fires `onclose` a tick later, by
 * which point a remount may already have started a new one — and that late
 * `onclose` would schedule a second. Two connections means every streamed
 * answer arrives twice, interleaved letter by letter into one unreadable
 * paragraph. So each attempt carries a number, and a socket that is no longer
 * the current one is ignored on every callback it has.
 */
export function useSocket(open: () => WebSocket, onMessage: (data: any) => void) {
  const [connected, setConnected] = useState(false)
  const socket = useRef<WebSocket | null>(null)
  const attempt = useRef(0)
  const generation = useRef(0)
  const retry = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const receive = useRef(onMessage)
  receive.current = onMessage

  const connect = useCallback(() => {
    const mine = generation.current
    let ws: WebSocket
    try {
      ws = open()
    } catch {
      setConnected(false)
      return
    }
    // Opened during a generation that has already ended: close it and leave.
    if (mine !== generation.current) {
      ws.close()
      return
    }
    socket.current = ws

    const current = () => mine === generation.current && socket.current === ws

    ws.onopen = () => {
      if (!current()) return ws.close()
      attempt.current = 0
      setConnected(true)
    }
    ws.onmessage = (event) => {
      if (!current()) return
      try { receive.current(JSON.parse(event.data)) } catch { /* an invalid frame */ }
    }
    ws.onerror = () => ws.close()
    ws.onclose = () => {
      if (!current()) return
      setConnected(false)
      // A growing wait up to 8s: the core usually comes back in a few seconds.
      const wait = Math.min(8000, 400 * 2 ** attempt.current++)
      retry.current = setTimeout(connect, wait)
    }
  }, [open])

  useEffect(() => {
    generation.current++
    connect()
    return () => {
      // Anything still holding this number stops mattering the moment it changes.
      generation.current++
      clearTimeout(retry.current)
      socket.current?.close()
      socket.current = null
    }
  }, [connect])

  const send = useCallback((data: unknown): boolean => {
    if (socket.current?.readyState !== WebSocket.OPEN) return false
    socket.current.send(JSON.stringify(data))
    return true
  }, [])

  return { connected, send }
}
