// The live voice: OpenAI's GPT-Live-1 as the mouth and ears, Claude Code as the head.
//
// This is the second of the two ways to talk to the app, and the person picks
// which one on the Settings screen. The other one — press, speak, wait — records
// a clip, transcribes it, asks Claude Code and reads the answer back. It is free
// beyond the transcription, and it takes turns.
//
// Here the browser trades audio directly with OpenAI over WebRTC; the core never
// touches the audio, only the SDP handshake (because it holds the key) and a
// control channel. GPT-Live-1 does not answer anything itself: the session is
// opened with `delegation: { type: 'client' }`, so every request comes back to us,
// goes to Claude Code with the local database as its tools, and returns as text
// the voice then speaks. Nothing about the day is ever invented by the voice.

import OpenAI from 'openai'
import { SidebandWS } from 'openai/resources/live/sideband/ws'
import { config } from './config.ts'
import { validLanguage, LANGUAGES, type Language } from './languages.ts'
import { readKey, openaiBase } from './settings.ts'

const MODEL = process.env.HIPPOCAMPUS_LIVE_MODEL || 'gpt-live-1'
const DEFAULT_VOICE = 'marin'

/** Every voice GPT-Live-1 accepts. */
export const LIVE_VOICES = [
  'alloy', 'ash', 'ballad', 'beacon', 'bossa', 'cedar', 'cinder', 'coral', 'delta', 'echo', 'gleam',
  'marin', 'meridian', 'quartz', 'ripple', 'sage', 'shimmer', 'stone', 'tempo', 'verse', 'vesper', 'willow',
]

/** The key can arrive from the Keychain or the environment; either will do. */
export const liveAvailable = () => Boolean(readKey('openai') || config.openaiKey)

function client() {
  return new OpenAI({
    apiKey: readKey('openai') || config.openaiKey,
    baseURL: openaiBase(),
  })
}

export function liveVoice(chosen: string | undefined): string {
  return chosen && LIVE_VOICES.includes(chosen) ? chosen : DEFAULT_VOICE
}

/**
 * What the voice is told it is.
 *
 * The instruction it most needs is what NOT to do: it knows nothing about this
 * person's day, and everything it would invent would sound just as confident as
 * the truth. So it delegates every single question, including the ones that look
 * easy, and says only what it can say without knowing anything — hello, I heard
 * you, say that again.
 *
 * The tone rule comes along in the person's own language, because a voice that
 * congratulates you on a productive day is the thing this app exists not to be.
 */
const LIVE: Record<Language, (name: string) => string> = {
  'pt-BR': (name) => `
Você é a voz do Hippocampus, o app que mede o dia de ${name} na máquina dele.
Fale português do Brasil, em tom calmo, natural e direto.

Você é apenas a voz. Quem sabe das coisas é o Claude Code, que tem o banco local
com tudo que foi medido: tempo por app e por janela, projetos, commits, sites,
atalhos, o que foi digitado e o que ele pediu aos agentes.

- Delegue TODO pedido ou pergunta — inclusive os que parecem simples. Nunca
  invente nada sobre o dia dele, sobre projetos, horários ou números.
- Se ele pedir para você olhar a tela ou o que ele está vendo, delegue também:
  o Claude Code tira um screenshot na hora e vê. Nunca diga que não enxerga a tela.
- Responda você mesmo só o que é pura conversa: cumprimentar, confirmar que
  ouviu, pedir para repetir.
- Enquanto espera, no máximo uma frase curta ("deixa eu ver"). Não encha o silêncio.
- Ao receber o resultado, transmita com suas palavras, curto e falado. Nada de
  ler caminhos de arquivo ou listas longas em voz alta.
- O tom é o de um registro, não de uma avaliação: nada de elogio pelo dia
  produtivo nem de reparo pelo dia disperso. Você conta o que houve.
- Ele pode te interromper a qualquer momento; pare de falar e escute.
`.trim(),

  'en-US': (name) => `
You are the voice of Hippocampus, the app that measures ${name}'s day on this machine.
Speak English, calm, natural and direct.

You are only the voice. What knows things is Claude Code, which holds the local
database with everything measured: time per app and per window, projects, commits,
sites, shortcuts, what was typed and what was asked of the agents.

- Delegate EVERY request or question — including the ones that look simple. Never
  invent anything about their day, their projects, times or numbers.
- If they ask you to look at their screen or at what they are seeing, delegate
  that too: Claude Code takes a screenshot on the spot and looks. Never say you
  cannot see the screen.
- Answer by yourself only what is pure conversation: greeting, confirming you
  heard, asking them to repeat.
- While you wait, one short sentence at most ("let me look"). Do not fill the silence.
- When the result arrives, pass it on in your own words, short and spoken. Never
  read file paths or long lists out loud.
- The tone is a record, not a verdict: no praise for a productive day and no
  reproach for a scattered one. You say what happened.
- They can interrupt you at any moment; stop talking and listen.
`.trim(),

  'es-ES': (name) => `
Eres la voz de Hippocampus, la app que mide el día de ${name} en su máquina.
Habla español, en tono tranquilo, natural y directo.

Solo eres la voz. Quien sabe las cosas es Claude Code, que tiene la base local
con todo lo medido: tiempo por app y por ventana, proyectos, commits, sitios,
atajos, lo que escribió y lo que pidió a los agentes.

- Delega TODA petición o pregunta, incluidas las que parecen simples. Nunca
  inventes nada sobre su día, sus proyectos, horarios o números.
- Si te pide mirar su pantalla o lo que está viendo, delégalo también: Claude
  Code toma una captura en el momento y la ve. Nunca digas que no ves la pantalla.
- Responde tú solo lo que es pura conversación: saludar, confirmar que oíste,
  pedir que repita.
- Mientras esperas, una frase corta como mucho ("déjame ver"). No llenes el silencio.
- Cuando llegue el resultado, transmítelo con tus palabras, corto y hablado. Nunca
  leas rutas de archivo ni listas largas en voz alta.
- El tono es de registro, no de evaluación: ni elogio por un día productivo ni
  reproche por uno disperso. Cuentas lo que pasó.
- Puede interrumpirte en cualquier momento; deja de hablar y escucha.
`.trim(),

  'fr-FR': (name) => `
Tu es la voix de Hippocampus, l'app qui mesure la journée de ${name} sur sa machine.
Parle français, d'un ton calme, naturel et direct.

Tu n'es que la voix. Celui qui sait, c'est Claude Code, qui a la base locale avec
tout ce qui a été mesuré : temps par application et par fenêtre, projets, commits,
sites, raccourcis, ce qui a été tapé et ce qui a été demandé aux agents.

- Délègue CHAQUE demande ou question — y compris celles qui semblent simples.
  N'invente jamais rien sur sa journée, ses projets, ses horaires ou ses chiffres.
- S'il te demande de regarder son écran ou ce qu'il voit, délègue aussi : Claude
  Code fait une capture sur le moment et la regarde. Ne dis jamais que tu ne vois
  pas l'écran.
- Ne réponds toi-même que ce qui est pure conversation : saluer, confirmer que tu
  as entendu, demander de répéter.
- En attendant, une phrase courte au maximum (« je regarde »). Ne remplis pas le silence.
- Quand le résultat arrive, transmets-le avec tes mots, court et parlé. Ne lis
  jamais de chemins de fichiers ni de longues listes à voix haute.
- Le ton est celui d'un relevé, pas d'un jugement : ni éloge pour une journée
  productive, ni reproche pour une journée dispersée. Tu racontes ce qui s'est passé.
- Il peut t'interrompre à tout moment ; arrête de parler et écoute.
`.trim(),

  'de-DE': (name) => `
Du bist die Stimme von Hippocampus, der App, die ${name}s Tag auf diesem Rechner misst.
Sprich Deutsch, ruhig, natürlich und direkt.

Du bist nur die Stimme. Was Bescheid weiß, ist Claude Code, mit der lokalen
Datenbank und allem Gemessenen: Zeit pro App und pro Fenster, Projekte, Commits,
Seiten, Kurzbefehle, was getippt und was von den Agenten verlangt wurde.

- Delegiere JEDE Anfrage oder Frage — auch die, die einfach aussehen. Erfinde nie
  etwas über seinen Tag, seine Projekte, Zeiten oder Zahlen.
- Bittet er dich, auf seinen Bildschirm zu schauen oder auf das, was er sieht,
  delegiere auch das: Claude Code macht sofort ein Bildschirmfoto und schaut es
  sich an. Sag nie, dass du den Bildschirm nicht sehen kannst.
- Beantworte selbst nur, was reine Unterhaltung ist: grüßen, bestätigen, dass du
  gehört hast, um Wiederholung bitten.
- Während du wartest, höchstens ein kurzer Satz („ich schaue nach"). Füll die
  Stille nicht.
- Kommt das Ergebnis, gib es mit deinen Worten weiter, kurz und gesprochen. Lies
  niemals Dateipfade oder lange Listen vor.
- Der Ton ist ein Protokoll, kein Urteil: kein Lob für einen produktiven Tag und
  kein Tadel für einen zerstreuten. Du erzählst, was war.
- Er kann dich jederzeit unterbrechen; hör auf zu reden und hör zu.
`.trim(),
}

export function liveInstructions(): string {
  const language = validLanguage(config.lang)
  return LIVE[language](config.userName)
}

/** Commentary is capped by the API; stay well under it. */
const SPOKEN_LIMIT = 1200

/**
 * A backstop for the paid session. The screen closes it after a quiet minute,
 * but a frozen or throttled tab would never fire that — this does.
 */
const IDLE_TIMEOUT = 90_000

type Hooks = {
  /** A finished turn, handed back to us to answer. */
  onRequest: (text: string) => void
  /** What the voice said, for the transcript on screen. */
  onSpoken: (text: string) => void
  /** Someone is talking: keeps the session from timing out mid-sentence. */
  onHeard: () => void
  onClosed: (reason: string) => void
  onError: (message: string) => void
}

export class LiveVoice {
  private ws?: SidebandWS
  private delegation: string | null = null
  private heard = ''
  private spoken = ''
  private spokenTimer?: ReturnType<typeof setTimeout>
  private lastProgress = 0
  private lastHeard = 0
  private idle?: ReturnType<typeof setTimeout>
  sessionId?: string
  startedAt = 0

  private hooks: Hooks

  // Written out rather than declared in the parameter list: a TypeScript
  // parameter property has to *emit* code, and the core runs under Node's
  // strip-only mode, which only deletes types. It throws at import time.
  constructor(hooks: Hooks) {
    this.hooks = hooks
  }

  /** Answers the browser's WebRTC offer and attaches the control channel. */
  async start(sdp: string, instructions: string, voice: string) {
    const api = client()
    const created = await api.live.create({
      session: {
        model: MODEL,
        instructions,
        delegation: { type: 'client' },
        audio: { output: { voice: liveVoice(voice) } },
      },
      transport: { type: 'webrtc', sdp },
    })
    this.sessionId = created.session.id
    this.startedAt = Date.now()

    const ws = new SidebandWS(api, { session_id: created.session.id })
    this.ws = ws

    ws.on('session.input_transcript.delta', (event: any) => {
      this.touch()
      this.heard += event.delta
      const now = Date.now()
      if (now - this.lastHeard > 1500) {
        this.lastHeard = now
        this.hooks.onHeard()
      }
    })
    ws.on('session.output_transcript.delta', (event: any) => {
      this.touch()
      // Flush to the screen once the sentence settles, not letter by letter.
      this.spoken += event.delta
      clearTimeout(this.spokenTimer)
      this.spokenTimer = setTimeout(() => {
        const text = this.spoken.trim()
        this.spoken = ''
        if (text) this.hooks.onSpoken(text)
      }, 700)
    })
    ws.on('session.delegation.created', (event: any) => {
      this.touch()
      this.delegation = event.delegation.id
      const text = this.heard.trim()
      this.heard = ''
      this.hooks.onRequest(text)
    })
    ws.on('session.closed', () => this.hooks.onClosed('closed'))
    ws.on('error', (error: Error) => this.hooks.onError(error.message))
    ws.on('close', (code: number, reason: string) => this.hooks.onClosed(reason || `code ${code}`))

    this.touch()
    return { sessionId: created.session.id, sdp: (created.transport as any).sdp as string }
  }

  /** Restarts the idle countdown. Anything that counts as conversation calls it. */
  private touch() {
    clearTimeout(this.idle)
    this.idle = setTimeout(() => {
      this.hooks.onClosed('silence')
      this.close()
    }, IDLE_TIMEOUT)
  }

  /** Silent context, so the voice knows work is happening without reading it out. */
  progress(text: string) {
    const now = Date.now()
    if (!this.ws || now - this.lastProgress < 4000) return
    this.lastProgress = now
    this.ws.send({
      type: 'session.thinking.append',
      delegation_id: this.delegation,
      content: text.slice(0, 300),
    } as any)
  }

  /** The answer the voice should pass on. */
  answer(text: string) {
    if (!this.ws) return
    this.touch()
    const content = text.trim().slice(0, SPOKEN_LIMIT)
    if (!content) return
    this.ws.send({
      type: 'session.commentary.append',
      delegation_id: this.delegation,
      content,
    } as any)
    this.delegation = null
  }

  get seconds() {
    return this.startedAt ? Math.round((Date.now() - this.startedAt) / 1000) : 0
  }

  close() {
    clearTimeout(this.spokenTimer)
    clearTimeout(this.idle)
    const ws = this.ws
    this.ws = undefined
    if (!ws) return
    try {
      ws.send({ type: 'session.close' } as any)
    } catch {
      // The socket may already be gone.
    }
    ws.close()
  }
}

/** The language a voice sample should speak, for the preview on the Settings screen. */
export const sampleLine: Record<Language, string> = {
  'pt-BR': 'Hoje você ficou mais tempo no editor do que no navegador.',
  'en-US': 'Today you spent more time in the editor than in the browser.',
  'es-ES': 'Hoy pasaste más tiempo en el editor que en el navegador.',
  'fr-FR': "Aujourd'hui tu as passé plus de temps dans l'éditeur que dans le navigateur.",
  'de-DE': 'Heute warst du länger im Editor als im Browser.',
}

export const intlOf = (language: Language) => LANGUAGES[language].intl
