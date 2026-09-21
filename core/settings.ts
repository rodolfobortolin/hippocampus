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
  config.typesafeKey = readKey('jev') || (process.env.TYPESAFE_API_KEY ?? '').trim()
  config.openaiKey = readKey('openai') || (process.env.OPENAI_API_KEY ?? '').trim()
  return settings
}

export function saveSettings(input: Partial<Settings>): Settings {
  const next: Settings = { ...readSettings(), ...input }
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
