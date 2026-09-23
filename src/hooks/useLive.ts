import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * The browser's half of the live voice.
 *
 * Audio goes straight from here to OpenAI over WebRTC and never touches the
 * core — the core only relays the SDP handshake, because it is the one holding
 * the key, and then talks to the session over its own control channel.
 *
 * Nothing is recorded here and nothing is stored: the microphone stream ends
 * the moment the session closes.
 */
export function useLive(opts: {
  /** Hands the offer to the core, which opens the session with it. */
  offer: (sdp: string) => void
  stop: () => void
  onLevel: (level: number) => void
}) {
  const [phase, setPhase] = useState<'off' | 'connecting' | 'on'>('off')
  const [error, setError] = useState<string>()
  const pc = useRef<RTCPeerConnection | undefined>(undefined)
  const mic = useRef<MediaStream | undefined>(undefined)
  const audio = useRef<HTMLAudioElement | undefined>(undefined)
  const meter = useRef<(() => void) | undefined>(undefined)
  const optsRef = useRef(opts)
  optsRef.current = opts

  const teardown = useCallback(() => {
    meter.current?.()
    meter.current = undefined
    mic.current?.getTracks().forEach((track) => track.stop())
    mic.current = undefined
    pc.current?.close()
    pc.current = undefined
    if (audio.current) {
      audio.current.srcObject = null
      audio.current = undefined
    }
    optsRef.current.onLevel(0)
    setPhase('off')
  }, [])

  /**
   * How loud the conversation is, so the sphere moves with it and not on a
   * timer — its voice, and yours.
   *
   * Only its voice used to move it, so while you talked the sphere sat still
   * and nothing said your voice was being heard. Both streams are metered in
   * one loop and the louder one wins; with echo cancellation on, its voice
   * coming back through your microphone stays below its own stream.
   */
  const metering = useRef<{ ac: AudioContext; sources: { analyser: AnalyserNode; floor: number }[] } | undefined>(undefined)
  const watch = (stream: MediaStream, floor: number) => {
    try {
      if (!metering.current) {
        const ac = new AudioContext()
        const sources: { analyser: AnalyserNode; floor: number }[] = []
        metering.current = { ac, sources }
        let raf = 0
        const tick = () => {
          let loudest = 0
          for (const { analyser, floor: noise } of sources) {
            const buffer = new Uint8Array(analyser.fftSize)
            analyser.getByteTimeDomainData(buffer)
            let sum = 0
            for (const value of buffer) sum += ((value - 128) / 128) ** 2
            loudest = Math.max(loudest, Math.max(0, Math.sqrt(sum / buffer.length) - noise) * 6)
          }
          optsRef.current.onLevel(Math.min(1, loudest))
          raf = requestAnimationFrame(tick)
        }
        tick()
        meter.current = () => {
          cancelAnimationFrame(raf)
          metering.current = undefined
          void ac.close()
        }
      }
      const analyser = metering.current.ac.createAnalyser()
      analyser.fftSize = 512
      metering.current.ac.createMediaStreamSource(stream).connect(analyser)
      metering.current.sources.push({ analyser, floor })
    } catch {
      // The level is decoration; the conversation works without it.
    }
  }

  const start = useCallback(async () => {
    if (pc.current) return
    setError(undefined)
    setPhase('connecting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
      mic.current = stream
      // A small floor for the room: breathing and a fan should not move it.
      watch(stream, 0.012)
      const connection = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      })
      pc.current = connection
      connection.addTrack(stream.getAudioTracks()[0], stream)
      connection.addTransceiver('audio', { direction: 'recvonly' })
      connection.ontrack = (event) => {
        const element = new Audio()
        element.autoplay = true
        element.srcObject = event.streams[0]
        void element.play().catch(() => undefined)
        audio.current = element
        watch(event.streams[0], 0)
      }
      connection.onconnectionstatechange = () => {
        const state = connection.connectionState
        if (state === 'failed' || state === 'closed') teardown()
      }
      await connection.setLocalDescription(await connection.createOffer())
      // Wait for the candidates, so the offer that goes out is complete.
      if (connection.iceGatheringState !== 'complete') {
        await new Promise<void>((resolve) => {
          const done = () => {
            if (connection.iceGatheringState === 'complete') {
              connection.removeEventListener('icegatheringstatechange', done)
              resolve()
            }
          }
          connection.addEventListener('icegatheringstatechange', done)
          setTimeout(resolve, 2000)
        })
      }
      optsRef.current.offer(connection.localDescription!.sdp)
      // If the core never answers — no key, an API error — do not sit in
      // "connecting" with the microphone open and nothing happening.
      setTimeout(() => {
        if (pc.current === connection && connection.remoteDescription === null) {
          teardown()
          setError('live-no-answer')
        }
      }, 15_000)
    } catch (problem) {
      teardown()
      setError(problem instanceof Error ? problem.message : String(problem))
    }
  }, [teardown])

  /** The core came back with the session's answer. */
  const accept = useCallback(async (sdp: string) => {
    if (!pc.current) return
    try {
      await pc.current.setRemoteDescription({ type: 'answer', sdp })
      setPhase('on')
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : String(problem))
      teardown()
    }
  }, [teardown])

  /** The session ended on the other side; let go of the microphone here too. */
  const dropped = useCallback(() => {
    if (pc.current) teardown()
  }, [teardown])

  const stop = useCallback(() => {
    if (!pc.current) return
    teardown()
    optsRef.current.stop()
  }, [teardown])

  useEffect(() => teardown, [teardown])

  return { phase, error, start, accept, stop, dropped }
}
