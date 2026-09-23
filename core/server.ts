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
import { capture, listNotes, noteFolders, NOTE_KINDS } from './notes.ts'
import { curate, capturesOf } from './curator.ts'
import { readSettings, saveSettings, writeKey, keyState, openaiBase, type KeyName } from './settings.ts'
import { LANGUAGES } from './languages.ts'
import { workItems, itemDetail } from './items.ts'
import { timesheet } from './timesheet.ts'
import { countRepos } from './sources/git.ts'
import { calendarAsk, calendarStatus, setCalendarStatus, keepMeetings, forgetMeetings } from './sources/calendar.ts'
import { LiveVoice, liveAvailable, liveInstructions, LIVE_VOICES } from './live.ts'
import { pointing } from './screen.ts'
import { blockedBrowsers, retryDeniedBrowsers } from './sources/browser.ts'
import { retryDeniedSkysight } from './sources/skysight.ts'
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

      // The focus helper asks whether to read the calendar, and brings what it read.
      if (route === '/api/calendar' && request.method === 'GET') {
        return json(response, calendarAsk(readSettings().calendar))
      }
      if (route === '/api/calendar' && request.method === 'POST') {
        const chunks: Buffer[] = []
        for await (const chunk of request) chunks.push(chunk as Buffer)
        const body = JSON.parse(Buffer.concat(chunks).toString() || '{}')
        // A helper still sending after the switch went off is not listened to.
        if (!readSettings().calendar) return json(response, { kept: 0 })
        setCalendarStatus(body.status === 'granted' ? 'granted' : 'denied')
        const kept = body.status === 'granted' && Array.isArray(body.events)
          ? keepMeetings(Number(body.from), Number(body.to), body.events) : 0
        return json(response, { kept })
      }

      if (route === '/api/settings' && request.method === 'GET') {
        return json(response, {
          ...readSettings(),
          calendarStatus: calendarStatus(),
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
        const before = readSettings()
        const settings = saveSettings(body)
        // Turning the calendar off forgets what it brought: off means off.
        if (before.calendar && !settings.calendar) forgetMeetings()
        // The switch has to reach the session, not just the next answer.
        if (settings.voiceMode !== 'live') closeLive?.()
        return json(response, {
          ...settings,
          calendarStatus: calendarStatus(),
          languages: LANGUAGES,
          liveVoices: LIVE_VOICES,
          liveAvailable: liveAvailable(),
          keys: { jev: keyState('jev'), openai: keyState('openai') },
        })
      }

      if (route.startsWith('/api/day/')) {
        const asked = route.slice('/api/day/'.length)
        const day = asked === 'today' ? today() : asked
        // A category picked under the ribbon narrows the panels made of the
        // same windows; the rest of the day is sent whole, as always.
        return json(response, dayReport(day, query.get('only')))
      }

      if (route === '/api/period') {
        const to = query.get('to') ?? today()
        const from = query.get('from') ?? dayOf(Date.now() / 1000 - 29 * 86_400)
        // A cell of the heatmap, or a whole row of it. Only the summary is
        // narrowed: the map itself stays whole, or there would be no other
        // cell left to pick.
        const slot = {
          weekday: slotNumber(query.get('weekday'), 6),
          hour: slotNumber(query.get('hour'), 23),
        }
        const narrowing = slot.weekday != null || slot.hour != null
        return json(response, {
          from, to, slot,
          days: rangeReport(from, to), rhythm: heatmap(from, to),
          // The whole period, always: the figures at the top describe it and
          // must not move when a cell is picked.
          summary: periodSummary(from, to),
          // The same summary, narrowed to the pick, for the charts under the map.
          narrowed: narrowing ? periodSummary(from, to, slot) : null,
        })
      }

      // Pieces of work across sources: tickets, pages, pull requests, per client.
      if (route === '/api/items') {
        const to = query.get('to') ?? today()
        const from = query.get('from') ?? dayOf(Date.now() / 1000 - 29 * 86_400)
        return json(response, workItems(from, to))
      }
      // The walkthrough: how many repositories a folder holds, so the person
      // sees at once whether they picked the right one.
      if (route === '/api/repos') {
        return json(response, await countRepos(query.get('root') ?? config.codeRoot))
      }
      // Raises the macOS Accessibility prompt, from the helper the core runs.
      if (route === '/api/permission/accessibility' && request.method === 'POST') {
        const asked = (collector ?? attached)?.focus?.askForAccessibility?.() ?? false
        return json(response, { asked })
      }

      if (route === '/api/timesheet') {
        const to = query.get('to') ?? today()
        return json(response, timesheet(query.get('from') ?? dayOf(Date.now() / 1000 - 6 * 86_400), to))
      }
      if (route === '/api/item') {
        const key = query.get('key') ?? ''
        return json(response, itemDetail(key, query.get('from') ?? '0000-00-00', query.get('to') ?? '9999-99-99'))
      }

      if (route === '/api/days') {
        return json(response, all(
          `select d.day, d.active_seconds, d.focus_ratio, d.top_app, d.narrative, d.recap, d.built_at
             from days d order by d.day desc limit 120`))
      }

      if (route === '/api/projects') return json(response, knownProjects())

      // The durable notes: what is already in the vault, and one more line in
      // it. The folders come along because the person deserves to see where a
      // capture is going before it goes.
      if (route === '/api/notes') {
        const kind = NOTE_KINDS.find((k) => k === query.get('kind')) ?? 'project'
        return json(response, { kind, folders: noteFolders(), titles: listNotes(kind), vault: vaultReady() })
      }

      // What the close of the day wrote into the person's own notes, and the
      // same thing asked for by hand — for a day that closed before this
      // existed, or one they want rewritten.
      if (route === '/api/captures') {
        const day = query.get('day') ?? dayOf(Date.now() / 1000 - 86_400)
        return json(response, { day, captures: capturesOf(day) })
      }

      if (route === '/api/curate' && request.method === 'POST') {
        const day = query.get('day') ?? dayOf(Date.now() / 1000 - 86_400)
        const kept = await curate(day, { again: query.get('again') === '1' })
        return json(response, { day, kept, captures: capturesOf(day) })
      }

      if (route === '/api/capture' && request.method === 'POST') {
        const chunks: Buffer[] = []
        for await (const chunk of request) chunks.push(chunk as Buffer)
        const body = JSON.parse(Buffer.concat(chunks).toString() || '{}')
        const kind = NOTE_KINDS.find((k) => k === body.kind)
        if (!kind) return json(response, { error: 'unknown kind' }, 400)
        try {
          const saved = capture({
            kind, title: String(body.title ?? ''), text: String(body.text ?? ''),
            section: body.section ? String(body.section) : undefined,
          })
          return json(response, saved)
        } catch (error) {
          // A missing vault or an empty title is the person's to fix, not a
          // crash: the message goes to the screen as it is.
          return json(response, { error: (error as Error).message }, 400)
        }
      }

      if (route === '/api/rollup' && request.method === 'POST') {
        const day = query.get('day') ?? dayOf(Date.now() / 1000 - 86_400)
        const result = await rollup(day, { narrate: query.get('narrate') !== '0' })
        return json(response, result)
      }

      // What macOS refused, and the way back. A source that was denied stops
      // being touched, because touching it is what raises the dialog — so
      // trying again has to be something the person asks for.
      if (route === '/api/blocked' && request.method === 'POST') {
        retryDeniedBrowsers()
        retryDeniedSkysight()
        return json(response, { ok: true })
      }

      if (route === '/api/blocked') {
        return json(response, { browsers: blockedBrowsers() })
      }

      if (route === '/api/wake' && request.method === 'POST') {
        // The listener heard the wake word. Whoever is on screen decides what to
        // do: start listening, or go quiet if it was speaking.
        for await (const _ of request) { /* discard the body */ }
        wake?.({ type: 'wake' })
        response.writeHead(204)
        return response.end()
      }

      if (route === '/api/room' && request.method === 'POST') {
        // The listener's microphone is open all day and records nothing, so
        // there is nothing on screen that says it is working. What it sends
        // here is one number — how loud the room is, never any audio — and
        // every open sphere moves with it while you speak.
        const chunks: Buffer[] = []
        for await (const chunk of request) chunks.push(chunk as Buffer)
        try {
          const { level } = JSON.parse(Buffer.concat(chunks).toString())
          wake?.({ type: 'room', level: Math.min(1, Math.max(0, Number(level) || 0)) })
        } catch {
          response.writeHead(400)
          return response.end()
        }
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

        const openai = await fetch(`${openaiBase()}/audio/transcriptions`, {
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
        const speech = await fetch(`${openaiBase()}/audio/speech`, {
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
  pointing.on('point', (place) => broadcast({ type: 'point', ...place }))

  /**
   * One conversation, however you reached it.
   *
   * The session is shared across every open screen on purpose: asking through
   * the floating core and then opening the panel should show the same thread,
   * not two halves of one. And because the answer is broadcast rather than
   * returned to whoever asked, the panel keeps the transcript of a question
   * that was only ever spoken into the sphere.
   */
  let session: string | undefined
  let nextScreen = 0
  /** Set once the socket server is up; the settings route uses it to hang up. */
  let closeLive: (() => void) | undefined

  /**
   * One live session for the whole app, not one per screen.
   *
   * There is one microphone and one person in front of it. With a session open
   * in the panel and another in the sphere, both heard the same sentence, both
   * delegated it, and both answered — one voice, then a second one over it.
   */
  let live: LiveVoice | undefined
  closeLive = () => {
    live?.close()
    live = undefined
  }

  sockets.on('connection', (socket, request) => {
    // Only the interface itself talks to the core.
    const origin = request.headers.origin
    if (origin && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin)) {
      socket.close(1008, 'origin not allowed')
      return
    }

    /**
     * Which screen this is, so a broadcast answer can still say who asked.
     *
     * Every screen shows the whole conversation, but only one of them should
     * read it out loud: with two open and no way to tell, the same answer came
     * out of the panel and the sphere at once, a beat apart.
     */
    const screenId = `screen-${++nextScreen}`
    // The session this screen opened, so closing the socket only takes down
    // its own.
    let mine: LiveVoice | undefined

    // What belongs to the conversation goes to every screen; what belongs to
    // this particular connection — the WebRTC handshake — goes only here.
    const toThisScreen = (event: unknown) =>
      socket.readyState === socket.OPEN && socket.send(JSON.stringify(event))
    const send = (event: Record<string, unknown>) => broadcast({ ...event, asker: screenId })

    toThisScreen({ type: 'hello', screen: screenId })

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
      // Turning the live voice off in Settings does not reach into an open
      // session, and a session left open goes on speaking while the screen,
      // now back in push mode, reads the same answer out through the speech
      // endpoint. The setting is what decides who has the voice.
      if (readSettings().voiceMode !== 'live') speaks = undefined
      // Said once, here, whether it was typed or spoken — so the panel does not
      // have to guess which turns it missed.
      send({ type: 'heard', text })
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
          else if (event.type === 'session') session = event.id
          else if (event.type === 'tool') {
            send({ type: 'tool', name: event.name })
            // The voice keeps someone company while the lookup runs, without
            // reading the tool's name out loud.
            if (event.name) speaks?.progress(`looking up ${event.name}`)
          }
          else {
            send({ type: 'error', error: event.error })
            // Without an answer the voice waits, and the session stays open
            // on its long backstop instead of closing after ten quiet seconds.
            speaks?.answer('That did not work: Claude Code could not finish the answer.')
          }
        }
      } catch (error) {
        send({ type: 'error', error: (error as Error).message })
        speaks?.answer('That did not work: Claude Code could not finish the answer.')
      }
    }

    /**
     * The session belongs to one screen, so its comings and goings are told to
     * that screen alone.
     *
     * Broadcasting them would have one screen closing its session tear down
     * the peer connection of another, and one screen opening its own announce
     * a session the others do not have.
     */
    const liveState = (on: boolean, seconds: number) =>
      toThisScreen({ type: 'live', on, seconds })

    const stopLive = () => {
      const seconds = mine?.seconds ?? 0
      if (live === mine) live = undefined
      mine?.close()
      mine = undefined
      liveState(false, seconds)
    }

    const startLive = async (sdp: string) => {
      if (!liveAvailable()) {
        return toThisScreen({ type: 'error', error: 'The live voice needs the OpenAI key.' })
      }
      // Whatever was open belongs to another screen, or to an earlier attempt
      // by this one. Either way it goes: two of these is two microphones on one
      // person, each hearing the same sentence and each answering it.
      live?.close()
      const session_ = new LiveVoice({
        onRequest: (text) => {
          if (!text) return
          void answer(text, session_)
        },
        onSpoken: (text) => send({ type: 'spoken', text }),
        onHeard: () => send({ type: 'listening' }),
        onCaption: (text) => send({ type: 'hearing', text }),
        onClosed: () => {
          // Only if it is still the one in hand: a session already replaced by
          // another screen must not clear the replacement on its way out.
          if (live === session_) live = undefined
          if (mine === session_) mine = undefined
          liveState(false, session_.seconds)
        },
        onError: (message) => toThisScreen({ type: 'error', error: `Live voice: ${message}` }),
      })
      live = session_
      mine = session_
      try {
        const opened = await session_.start(sdp, liveInstructions(), readSettings().liveVoice)
        // The handshake belongs to the screen that made the offer: an answer
        // meant for one peer connection is useless anywhere else.
        toThisScreen({ type: 'live-answer', sdp: opened.sdp })
        liveState(true, 0)
      } catch (error) {
        if (live === session_) live = undefined
        if (mine === session_) mine = undefined
        const message = (error as Error).message
        console.error('[live]', message)
        toThisScreen({ type: 'error', error: `Live voice: ${message}` })
        liveState(false, 0)
      }
    }

    socket.on('message', async (raw) => {
      let payload: any
      try { payload = JSON.parse(String(raw)) } catch { return }
      if (payload.type === 'live-offer' && payload.sdp) return void startLive(String(payload.sdp))
      if (payload.type === 'live-stop') return stopLive()
      if (payload.type !== 'question' || !payload.text) return
      // A typed question is spoken by the live session when one is open, so
      // the two ways of asking share one voice rather than talking over it.
      await answer(String(payload.text), live)
    })

    socket.on('close', () => {
      // Only this screen's own session goes: another screen's has to survive.
      if (live === mine) live = undefined
      mine?.close()
      mine = undefined
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

/** A slot coordinate from the query string: a whole number in range, or none. */
function slotNumber(raw: string | null, max: number): number | null {
  if (raw === null || raw === '') return null
  const value = Number(raw)
  return Number.isInteger(value) && value >= 0 && value <= max ? value : null
}

/** Attaches the collector to the already-running server, so /api/status can see it. */
export function attachCollector(collector: Collector): void {
  attached = collector
}
