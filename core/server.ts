import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { WebSocketServer } from 'ws'
import { config, today, dayOf } from './config.ts'
import { all, one } from './db.ts'
import { dayReport, rangeReport, heatmap, overview, knownProjects, periodSummary } from './metrics.ts'
import { chat } from './agent.ts'
import { rollup } from './rollup.ts'
import { jevReady } from './jev.ts'
import { claudeAvailable } from './claude.ts'
import { vaultReady } from './vault.ts'
import { readSettings, saveSettings, writeKey, keyState, type KeyName } from './settings.ts'
import { LANGUAGES } from './languages.ts'
import { LiveVoice, liveAvailable, liveInstructions, LIVE_VOICES } from './live.ts'
import type { Collector } from './collector.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const distDir = path.join(root, 'dist')

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json',
  '.woff2': 'font/woff2', '.png': 'image/png',
}

function json(response: http.ServerResponse, data: unknown, status = 200): void {
  const body = JSON.stringify(data)
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(body) })
  response.end(body)
}

/**
 * Brings up the local API. Listens on 127.0.0.1 only — none of this is exposed
 * to the network. The collector can be attached later, with `attachCollector`,
 * so the server never waits on a harvest before it starts answering.
 */
let attached: Collector | undefined
let wake: ((event: unknown) => void) | undefined

export function serve(collector?: Collector): http.Server {
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`)
    const route = url.pathname
    const query = url.searchParams

    // The interface runs on another port during development; allow the local machine only.
    const origin = request.headers.origin
    if (origin && /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin)) {
      response.setHeader('access-control-allow-origin', origin)
      response.setHeader('access-control-allow-headers', 'content-type')
    }
    if (request.method === 'OPTIONS') {
      response.writeHead(204)
      return response.end()
    }

    try {
      if (route === '/api/status') {
        return json(response, {
          collector: (collector ?? attached)?.status() ?? { running: false },
          jev: jevReady(),
          claude: await claudeAvailable(),
          vault: vaultReady(),
          voice: Boolean(config.openaiKey),
          user: config.userName,
          language: config.lang,
          ...overview(),
        })
      }

      if (route === '/api/settings' && request.method === 'GET') {
        return json(response, {
          ...readSettings(),
          languages: LANGUAGES,
          liveVoices: LIVE_VOICES,
          liveAvailable: liveAvailable(),
          keys: { jev: keyState('jev'), openai: keyState('openai') },
        })
      }

      if (route === '/api/settings' && request.method === 'POST') {
        const chunks: Buffer[] = []
        for await (const chunk of request) chunks.push(chunk as Buffer)
        const body = JSON.parse(Buffer.concat(chunks).toString() || '{}')
        // The keys never come back through the API: only their state. What
        // comes in here goes straight to the Keychain and leaves memory.
        for (const name of ['jev', 'openai'] as KeyName[]) {
          const value = body.keys?.[name]
          if (typeof value === 'string') await writeKey(name, value.trim())
        }
        delete body.keys
        const settings = saveSettings(body)
        return json(response, {
          ...settings,
          languages: LANGUAGES,
          liveVoices: LIVE_VOICES,
          liveAvailable: liveAvailable(),
          keys: { jev: keyState('jev'), openai: keyState('openai') },
        })
      }

      if (route.startsWith('/api/day/')) {
        const day = route.slice('/api/day/'.length)
        return json(response, dayReport(day === 'today' ? today() : day))
      }

      if (route === '/api/period') {
        const to = query.get('to') ?? today()
        const from = query.get('from') ?? dayOf(Date.now() / 1000 - 29 * 86_400)
        return json(response, {
          from, to,
          days: rangeReport(from, to), rhythm: heatmap(from, to), summary: periodSummary(from, to),
        })
      }

      if (route === '/api/days') {
        return json(response, all(
          `select d.day, d.active_seconds, d.focus_ratio, d.top_app, d.narrative, d.recap, d.built_at
             from days d order by d.day desc limit 120`))
      }

      if (route === '/api/projects') return json(response, knownProjects())

      if (route === '/api/rollup' && request.method === 'POST') {
        const day = query.get('day') ?? dayOf(Date.now() / 1000 - 86_400)
        const result = await rollup(day, { narrate: query.get('narrate') !== '0' })
        return json(response, result)
      }

      if (route === '/api/wake' && request.method === 'POST') {
        // The listener heard the wake word. Whoever is on screen decides what to
        // do: start listening, or go quiet if it was speaking.
        for await (const _ of request) { /* discard the body */ }
        wake?.({ type: 'wake' })
        response.writeHead(204)
        return response.end()
      }

      if (route === '/api/sample' && request.method === 'POST') {
        // launchd's helper pushes one sample at a time. A bare 204 answers it:
        // there is nothing to return and the helper expects no body.
        const chunks: Buffer[] = []
        for await (const chunk of request) chunks.push(chunk as Buffer)
        try {
          ;(collector ?? attached)?.focus.push(JSON.parse(Buffer.concat(chunks).toString()))
        } catch {
          response.writeHead(400)
          return response.end()
        }
        response.writeHead(204)
        return response.end()
      }

      if (route === '/api/transcribe' && request.method === 'POST') {
        // The browser's speech API does not work in Electron: it depends on a
        // Google service only Chrome has credentials for, and fails at once
        // with a network error. Here the audio is recorded and transcribed.
        if (!config.openaiKey) return json(response, { error: 'no key' }, 400)
        const chunks: Buffer[] = []
        for await (const chunk of request) chunks.push(chunk as Buffer)
        const audio = Buffer.concat(chunks)
        if (!audio.length) return json(response, { error: 'empty audio' }, 400)

        const form = new FormData()
        form.append('file', new Blob([audio], { type: 'audio/webm' }), 'speech.webm')
        form.append('model', 'gpt-4o-mini-transcribe')
        // Without the language hint the model confuses Portuguese with Italian.
        form.append('language', config.lang.split('-')[0])

        const openai = await fetch(`${config.openaiBaseUrl}/audio/transcriptions`, {
          method: 'POST',
          headers: { authorization: `Bearer ${config.openaiKey}` },
          body: form,
        })
        if (!openai.ok) {
          // A refused key is not a server error and it is not the person's
          // fault for pressing the button. It has one cause and one cure, and
          // dumping OpenAI's JSON at them says neither.
          if (openai.status === 401) return json(response, { error: 'key-refused' }, 502)
          return json(response, { error: (await openai.text()).slice(0, 300) }, 502)
        }
        const data = (await openai.json()) as { text?: string }
        return json(response, { text: (data.text ?? '').trim() })
      }

      if (route === '/api/speak' && request.method === 'POST') {
        // Speaks the text in OpenAI's voice. With no key, the app uses the system's.
        if (!config.openaiKey) return json(response, { error: 'no key' }, 400)
        const chunks: Buffer[] = []
        for await (const chunk of request) chunks.push(chunk as Buffer)
        const { text, voice } = JSON.parse(Buffer.concat(chunks).toString() || '{}')
        const speech = await fetch(`${config.openaiBaseUrl}/audio/speech`, {
          method: 'POST',
          headers: { authorization: `Bearer ${config.openaiKey}`, 'content-type': 'application/json' },
          body: JSON.stringify({ model: 'gpt-4o-mini-tts', voice: voice ?? config.voice, input: String(text).slice(0, 4000) }),
        })
        if (!speech.ok) {
          if (speech.status === 401) return json(response, { error: 'key-refused' }, 502)
          return json(response, { error: (await speech.text()).slice(0, 300) }, 502)
        }
        const audio = Buffer.from(await speech.arrayBuffer())
        response.writeHead(200, { 'content-type': 'audio/mpeg', 'content-length': audio.length })
        return response.end(audio)
      }

      // In production the core itself serves the compiled interface.
      if (!route.startsWith('/api/') && fs.existsSync(distDir)) {
        const candidate = path.join(distDir, route === '/' ? 'index.html' : route.slice(1))
        const file = fs.existsSync(candidate) && fs.statSync(candidate).isFile()
          ? candidate : path.join(distDir, 'index.html')
        if (fs.existsSync(file)) {
          const body = fs.readFileSync(file)
          response.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' })
          return response.end(body)
        }
      }

      json(response, { error: 'not found' }, 404)
    } catch (error) {
      console.error('[api]', route, (error as Error).message)
      json(response, { error: (error as Error).message }, 500)
    }
  })

  const sockets = new WebSocketServer({ server, path: '/ws' })

  /** Tells every open screen — the panel and the floating core. */
  const broadcast = (event: unknown) => {
    const text = JSON.stringify(event)
    for (const client of sockets.clients) {
      if (client.readyState === client.OPEN) client.send(text)
    }
  }
  wake = broadcast
  sockets.on('connection', (socket, request) => {
    // Only the interface itself talks to the core.
    const origin = request.headers.origin
    if (origin && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin)) {
      socket.close(1008, 'origin not allowed')
      return
    }

    let session: string | undefined
    let live: LiveVoice | undefined
    const send = (event: unknown) => socket.readyState === socket.OPEN && socket.send(JSON.stringify(event))

    /**
     * One question, answered by Claude Code with the local database as its tools.
     *
     * `speaks` is what separates the two ways of talking: typed, the answer
     * streams to the screen and the screen decides whether to read it out;
     * spoken through the live voice, the finished answer goes back to the voice,
     * which says it in its own words — and the pieces still go to the screen so
     * there is a transcript to read.
     */
    const answer = async (text: string, speaks: LiveVoice | undefined) => {
      send({ type: 'thinking' })
      try {
        for await (const event of chat(text, session)) {
          if (event.type === 'model') send({ type: 'model', model: event.model, level: event.level })
          else if (event.type === 'delta') send({ type: 'delta', text: event.text })
          else if (event.type === 'end') {
            send({ type: 'end', text: event.text })
            speaks?.answer(event.text)
          }
          else if (event.type === 'text') send({ type: 'text', text: event.text })
          else if (event.type === 'tool') {
            send({ type: 'tool', name: event.name })
            // The voice keeps someone company while the lookup runs, without
            // reading the tool's name out loud.
            if (event.name) speaks?.progress(`looking up ${event.name}`)
          }
          else send({ type: 'error', error: event.error })
        }
      } catch (error) {
        send({ type: 'error', error: (error as Error).message })
      }
    }

    const stopLive = () => {
      const seconds = live?.seconds ?? 0
      live?.close()
      live = undefined
      send({ type: 'live', on: false, seconds })
    }

    const startLive = async (sdp: string) => {
      if (!liveAvailable()) {
        return send({ type: 'error', error: 'The live voice needs the OpenAI key.' })
      }
      live?.close()
      const session_ = new LiveVoice({
        onRequest: (text) => {
          if (!text) return
          send({ type: 'heard', text })
          void answer(text, session_)
        },
        onSpoken: (text) => send({ type: 'spoken', text }),
        onHeard: () => send({ type: 'listening' }),
        onClosed: () => {
          live = undefined
          send({ type: 'live', on: false, seconds: session_.seconds })
        },
        onError: (message) => send({ type: 'error', error: `Live voice: ${message}` }),
      })
      live = session_
      try {
        const opened = await session_.start(sdp, liveInstructions(), readSettings().liveVoice)
        send({ type: 'live-answer', sdp: opened.sdp })
        send({ type: 'live', on: true, seconds: 0 })
      } catch (error) {
        live = undefined
        const message = (error as Error).message
        console.error('[live]', message)
        send({ type: 'error', error: `Live voice: ${message}` })
        send({ type: 'live', on: false, seconds: 0 })
      }
    }

    socket.on('message', async (raw) => {
      let payload: any
      try { payload = JSON.parse(String(raw)) } catch { return }
      if (payload.type === 'live-offer' && payload.sdp) return void startLive(String(payload.sdp))
      if (payload.type === 'live-stop') return stopLive()
      if (payload.type !== 'question' || !payload.text) return
      await answer(String(payload.text), live)
    })

    socket.on('close', () => {
      live?.close()
      live = undefined
    })
  })

  server.on('error', (error) => {
    console.error('[core] could not listen:', (error as Error).message)
  })
  server.listen(config.port, '127.0.0.1', () => {
    console.log(`[core] http://127.0.0.1:${config.port}`)
  })
  return server
}

/** Attaches the collector to the already-running server, so /api/status can see it. */
export function attachCollector(collector: Collector): void {
  attached = collector
}
