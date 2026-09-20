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
 * Writes a secret into the Keychain. The value travels through standard input
 * rather than through the arguments — a process argument is readable by any
 * `ps` on the machine.
 */
export function writeKey(name: KeyName, value: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const account = ACCOUNTS[name]
    if (!value) {
      execFile('security', ['delete-generic-password', '-a', account, '-s', SERVICE], () => resolve())
      return
    }
    const child = execFile('security',
      ['add-generic-password', '-a', account, '-s', SERVICE, '-U', '-D', 'API key', '-w'],
      (error) => (error ? reject(error) : resolve()))
    // `security` asks for the password twice when `-w` comes with no value.
    child.stdin?.end(`${value}\n${value}\n`)
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
}

/**
 * The settings as they were stored before the rename, in Portuguese.
 *
 * Reading them costs one lookup and saves someone from finding their language,
 * their vault and the hour their day turns all reset to defaults after an
 * update they did not ask for.
 */
function fromOldShape(raw: string): Partial<Settings> {
  const old = JSON.parse(raw) as Record<string, unknown>
  return {
    language: old.language as Language, name: old.name as string, vault: old.vault as string,
    journalFolder: old.pastaDiario as string, dayStartHour: old.inicioDoDia as number,
    keepTyping: old.guardarDigitacao as boolean, voice: old.voz as string,
  }
}

export function readSettings(): Settings {
  const stored = getMeta('settings') || getMeta('settings')
  if (!stored) return { ...DEFAULTS }
  try {
    const parsed = JSON.parse(stored) as Record<string, unknown>
    const data = 'language' in parsed ? fromOldShape(stored) : (parsed as Partial<Settings>)
    return {
      language: validLanguage(String(data.language ?? DEFAULTS.language)),
      name: String(data.name ?? DEFAULTS.name).trim() || DEFAULTS.name,
      vault: String(data.vault ?? DEFAULTS.vault),
      journalFolder: String(data.journalFolder ?? DEFAULTS.journalFolder),
      dayStartHour: Math.min(12, Math.max(0, Number(data.dayStartHour ?? DEFAULTS.dayStartHour) || 0)),
      keepTyping: data.keepTyping !== false,
      voice: String(data.voice ?? DEFAULTS.voice),
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
