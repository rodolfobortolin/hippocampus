import { execFile, execFileSync } from 'node:child_process'
import fs from 'node:fs'
import { config } from './config.ts'
import { getMeta, setMeta } from './db.ts'
import { validLanguage, type Language } from './languages.ts'

/**
 * The app's settings, editable from inside it.
 *
 * Whatever is not a secret lives in the database's own `meta` table. What is a
 * secret — the two keys — lives in the macOS Keychain, never in a text file and
 * never in a commit. A `.env` still works for development, but it loses to the
 * Keychain: what the person types in the app is what counts.
 */
export type Settings = {
  language: Language
  name: string
  vault: string
  journalFolder: string
  dayStartHour: number
  keepTyping: boolean
  voice: string
  /**
   * The keyboard shortcut that calls the core, in Electron's accelerator form
   * ("CommandOrControl+Shift+Space"). Empty turns it off — a shortcut that
   * fights another app is worse than none.
   */
  shortcut: string
  /**
   * How the voice works. `push` records a clip, transcribes it, asks Claude Code
   * and reads the answer back — turn by turn, and it costs only the
   * transcription. `live` opens a real-time session: it hears you while you
   * speak, you can interrupt it, and it bills for the time the session is open.
   * The choice is the person's, and `push` is what they get without asking.
   */
  voiceMode: 'push' | 'live'
  /** Which GPT-Live-1 voice speaks, when the live mode is on. */
  liveVoice: string
  /**
   * Which OpenAI geography the key belongs to.
   *
   * A key issued inside a European project reaches `/v1/models` on the global
   * host and is refused by the live endpoint — "Attempted to access resource
   * from outside project geography EU" — so the key looks half working, which
   * is worse than not working.
   */
  region: Region
  /**
   * Whether the floating core writes what it heard and what it answered.
   *
   * Off leaves the sphere alone on the desktop: it still listens and still
   * speaks, it just stops putting words over whatever is behind it. What goes
   * wrong is still said — an error nobody can see is worse than no caption.
   */
  caption: boolean
  /**
   * Whether the listener waits for the wake word. Waiting is the macOS
   * recogniser running all day on the microphone — over half a core with the
   * Neural Engine's process on top — so it is a choice, and the listener
   * follows it within ten seconds: off closes the microphone. The shortcut and
   * a click on the sphere call the core either way.
   */
  wakeWord: boolean
  /**
   * Whether the conversation may use anything beyond this app's own database.
   *
   * Off, it answers only from what was measured on this machine, and nothing
   * it does reaches the network or the filesystem. On, it gets the rest of
   * Claude Code — reading files, running commands, searching the web — and
   * every MCP server already configured on the machine.
   *
   * It is off until asked for, because turning it on changes two things at
   * once: the assistant can act on the machine without stopping to ask, and
   * what it looks at can leave it.
   */
  wideTools: boolean
  /**
   * Whether meeting names come from the macOS Calendar.
   *
   * Off until asked for, and nothing is requested until then: the permission
   * prompt appears only after the switch is turned on, asked by the focus
   * helper under its own name.
   */
  calendar: boolean
  /**
   * Whether the close of the day also writes the durable notes — project,
   * knowledge, person — into the vault, the way the journal is written.
   * Off leaves the Notes tab to the person's own hand.
   */
  captures: boolean
  /**
   * How each panel is drawn, where it can be drawn two ways — bars or a pie —
   * keyed by panel ("today.apps"). A panel not named is drawn as bars.
   */
  views: Record<string, 'bars' | 'pie'>
  /**
   * Whether the week's hours are drafted by client and piece of work — for
   * someone who bills by the hour. For anyone else a timesheet reads as
   * surveillance, so it stays off until asked for.
   */
  timesheet: boolean
  /**
   * The folders the repositories live in. It was one folder, fixed at
   * ~/Documents/GitHub, which is where this machine keeps them and almost
   * nobody else does; then one folder, chosen; now as many as the person's
   * code is spread across.
   */
  codeRoots: string[]
  /**
   * The person's word on whose each thing is — a repository owner, a Jira
   * site, one repository, a place time went — keyed as core/owners.ts names
   * them ("owner:acme", "repo:sidequest"). It outranks every rule the
   * timesheet has: the rules guess, this was said.
   */
  owners: Record<string, OwnerAnswer>
  /**
   * Anything else that tells work from personal, in the person's words —
   * "Watlow and prodapac are clients I serve through Valiantys". Handed to jev
   * when it is asked which client a window with no owner was for.
   */
  context: string
  /** Whether the first-run walkthrough was finished or skipped. */
  onboarded: boolean
}

/** A client, under the name to show it with; the person's own; or not work at all. */
export type OwnerAnswer = { as: 'client'; client: string } | { as: 'personal' } | { as: 'none' }

function validAnswer(value: unknown): OwnerAnswer | null {
  const answer = value as { as?: unknown; client?: unknown } | null
  if (answer?.as === 'personal' || answer?.as === 'none') return { as: answer.as }
  if (answer?.as === 'client' && typeof answer.client === 'string' && answer.client.trim()) {
    return { as: 'client', client: answer.client.trim().slice(0, 60) }
  }
  return null
}

export type Region = 'global' | 'eu'

const REGIONS: Record<Region, string> = {
  global: 'https://api.openai.com/v1',
  eu: 'https://eu.api.openai.com/v1',
}

export type KeyState = 'keychain' | 'environment' | 'empty'

const SERVICE = 'Hippocampus'
const OLD_SERVICE = 'Hipocampo'
const ACCOUNTS = { jev: 'typesafe-api-key', openai: 'openai-api-key' } as const
export type KeyName = keyof typeof ACCOUNTS

function fromKeychain(account: string, service: string): string {
  try {
    return execFileSync('security', ['find-generic-password', '-a', account, '-s', service, '-w'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return ''
  }
}

/**
 * Reads a secret from the Keychain. A missing one is an empty string, not an
 * error.
 *
 * The old service name is still consulted: the app was called Hipocampo before
 * it was called Hippocampus, and a rename is no reason to make someone paste
 * their keys again.
 */
export function readKey(name: KeyName): string {
  return fromKeychain(ACCOUNTS[name], SERVICE) || fromKeychain(ACCOUNTS[name], OLD_SERVICE)
}

/**
 * Writes a secret into the Keychain.
 *
 * Through `security -i`, which takes the whole command on standard input, for
 * two reasons that pull the same way.
 *
 * The value stays out of the arguments, so no `ps` on this machine can read
 * it. And `-w` with no value falls back to an interactive prompt that **cuts
 * the password at 128 characters** without a word — it stores the truncated
 * one and exits zero. An OpenAI service-account key is 167 characters, so not
 * one of them was ever stored whole: the app saved 128 of them and OpenAI
 * answered "Incorrect API key provided" to a key the person had pasted
 * correctly, twice.
 */
export function writeKey(name: KeyName, value: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const account = ACCOUNTS[name]
    if (!value) {
      execFile('security', ['delete-generic-password', '-a', account, '-s', SERVICE], () => resolve())
      return
    }
    // In batch mode the line is parsed as a command, so anything that could end
    // the argument early would corrupt the secret rather than fail loudly.
    if (/[\s"'\\]/.test(value)) {
      reject(new Error('a key cannot contain spaces or quotes'))
      return
    }
    const child = execFile('security', ['-i'], (error) => (error ? reject(error) : resolve()))
    child.stdin?.end(
      `add-generic-password -a ${account} -s ${SERVICE} -U -D "API key" -w ${value}\n`)
  })
}

export function keyState(name: KeyName): KeyState {
  if (readKey(name)) return 'keychain'
  const fromEnvironment = name === 'jev' ? process.env.TYPESAFE_API_KEY : process.env.OPENAI_API_KEY
  return (fromEnvironment ?? '').trim() ? 'environment' : 'empty'
}

const DEFAULTS: Settings = {
  language: validLanguage(config.lang),
  name: config.userName,
  vault: config.vault,
  journalFolder: 'Journal',
  dayStartHour: config.dayStartHour,
  keepTyping: config.keepTyping,
  voice: 'onyx',
  shortcut: 'CommandOrControl+Shift+Space',
  voiceMode: 'push',
  liveVoice: 'marin',
  region: 'global',
  caption: true,
  wakeWord: true,
  wideTools: false,
  calendar: false,
  // Off for someone installing it fresh: a stranger's app writing into their
  // own notes on its first night should have been asked first. The walkthrough
  // offers it; a choice already stored is kept either way.
  captures: false,
  views: {},
  timesheet: false,
  codeRoots: config.codeRoots,
  owners: {},
  context: '',
  onboarded: false,
}

/**
 * The settings as they were stored before the rename, in Portuguese.
 *
 * Every key here is a Portuguese string literal on purpose — they name rows
 * and fields that already exist on someone's disk. A rename that reaches into
 * this function silently drops everything the person had configured, which is
 * exactly what happened once.
 *
 * Reading them costs one lookup and saves someone from finding their language,
 * their vault and the hour their day turns all reset to defaults after an
 * update they did not ask for.
 */
function fromOldShape(raw: string): Partial<Settings> {
  const old = JSON.parse(raw) as Record<string, unknown>
  return {
    language: old.idioma as Language, name: old.nome as string, vault: old.vault as string,
    journalFolder: old.pastaDiario as string, dayStartHour: old.inicioDoDia as number,
    keepTyping: old.guardarDigitacao as boolean, voice: old.voz as string,
  }
}

/** The code folders stored; a setting from before there could be several named one, as `codeRoot`. */
function codeRootsOf(data: Record<string, unknown>): string[] {
  if (Array.isArray(data.codeRoots)) {
    return [...new Set(data.codeRoots.map((root) => String(root).trim()).filter(Boolean))].slice(0, 12)
  }
  const one = String(data.codeRoot ?? '').trim()
  return one ? [one] : DEFAULTS.codeRoots
}

export function readSettings(): Settings {
  const stored = getMeta('settings') || getMeta('ajustes')
  if (!stored) return { ...DEFAULTS }
  try {
    const parsed = JSON.parse(stored) as Record<string, unknown>
    const data = 'idioma' in parsed ? fromOldShape(stored) : (parsed as Partial<Settings>)
    return {
      language: validLanguage(String(data.language ?? DEFAULTS.language)),
      name: String(data.name ?? DEFAULTS.name).trim() || DEFAULTS.name,
      vault: String(data.vault ?? DEFAULTS.vault),
      journalFolder: String(data.journalFolder ?? DEFAULTS.journalFolder),
      dayStartHour: Math.min(12, Math.max(0, Number(data.dayStartHour ?? DEFAULTS.dayStartHour) || 0)),
      keepTyping: data.keepTyping !== false,
      voice: String(data.voice ?? DEFAULTS.voice),
      shortcut: String(data.shortcut ?? DEFAULTS.shortcut),
      voiceMode: data.voiceMode === 'live' ? 'live' : 'push',
      liveVoice: String(data.liveVoice ?? DEFAULTS.liveVoice),
      region: data.region === 'eu' ? 'eu' : 'global',
      caption: data.caption !== false,
      wakeWord: data.wakeWord !== false,
      wideTools: data.wideTools === true,
      calendar: data.calendar === true,
      captures: data.captures ?? DEFAULTS.captures,
      views: Object.fromEntries(Object.entries((data.views ?? {}) as Record<string, unknown>)
        .filter(([key, view]) => key.length < 40 && (view === 'bars' || view === 'pie'))) as Record<string, 'bars' | 'pie'>,
      timesheet: data.timesheet === true,
      // A setting stored as one folder, before there could be several, is kept.
      codeRoots: codeRootsOf(data),
      owners: Object.fromEntries(Object.entries((data.owners ?? {}) as Record<string, unknown>)
        .map(([key, value]) => [key, validAnswer(value)] as const)
        .filter((entry): entry is [string, OwnerAnswer] => entry[0].length < 120 && entry[1] !== null)),
      context: String(data.context ?? '').slice(0, 2000),
      onboarded: data.onboarded === true,
    }
  } catch {
    return { ...DEFAULTS }
  }
}

/**
 * Pours the settings over the live config. Everyone reads `config.x` at the
 * moment of use, so changing it here changes the whole app without a restart —
 * except the interface, which reloads its strings on its own.
 */
export function applySettings(settings: Settings = readSettings()): Settings {
  config.lang = settings.language
  config.userName = settings.name
  config.vault = settings.vault
  config.journalFolder = settings.journalFolder
  config.dayStartHour = settings.dayStartHour
  config.keepTyping = settings.keepTyping
  config.voice = settings.voice
  config.codeRoots = settings.codeRoots
  config.typesafeKey = readKey('jev') || (process.env.TYPESAFE_API_KEY ?? '').trim()
  config.openaiKey = readKey('openai') || (process.env.OPENAI_API_KEY ?? '').trim()
  return settings
}

export function saveSettings(input: Partial<Settings>): Settings {
  const current = readSettings()
  // The views arrive one panel at a time and are merged, never replaced: two
  // quick clicks on two panels sent two maps built from the same stale copy,
  // and the second write erased the first choice.
  // The answers about owners arrive one at a time too, and merge the same
  // way; an answer sent as null is taken back, and the rules decide again.
  const owners: Record<string, OwnerAnswer> = { ...current.owners }
  for (const [key, value] of Object.entries((input.owners ?? {}) as Record<string, unknown>)) {
    const answer = validAnswer(value)
    if (answer) owners[key] = answer
    else delete owners[key]
  }
  const next: Settings = { ...current, ...input, views: { ...current.views, ...(input.views ?? {}) }, owners }
  next.codeRoots = codeRootsOf(next as unknown as Record<string, unknown>)
  // A new context makes jev's earlier answers about clients worth asking again.
  if (input.context !== undefined && input.context !== current.context) setMeta('context.changed', String(Math.floor(Date.now() / 1000)))
  // Storing a folder that does not exist would only produce a journal that
  // vanishes.
  if (next.vault && !fs.existsSync(next.vault)) next.vault = readSettings().vault
  setMeta('settings', JSON.stringify(next))
  return applySettings(next)
}


/**
 * Where OpenAI is reached, for the voice.
 *
 * The region chosen in the app decides it. `OPENAI_BASE_URL` still wins when it
 * points somewhere that is neither of OpenAI's own hosts — that is a proxy or a
 * gateway, and it is set on purpose. Pointing it at the stock global host does
 * not override the choice, because that is the default sitting in `.env.example`
 * and it would quietly beat what the person picked on screen.
 */
export function openaiBase(): string {
  const fromEnv = (process.env.OPENAI_BASE_URL ?? '').trim().replace(/\/$/, '')
  const known = Object.values(REGIONS)
  if (fromEnv && !known.includes(fromEnv)) return fromEnv
  return REGIONS[readSettings().region]
}
