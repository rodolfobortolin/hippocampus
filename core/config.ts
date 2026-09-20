import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

/**
 * An environment variable, under the current name or the one used before the
 * app was renamed. Nobody should have to rewrite their `.env` over a rename.
 */
function env(key: string, fallback = ''): string {
  const current = (process.env[`HIPPOCAMPUS_${key}`] ?? '').trim()
  const previous = (process.env[`HIPOCAMPO_${key}`] ?? '').trim()
  return current || previous || fallback
}

/** A variable that never carried the app's name, like the provider keys. */
function plain(key: string, fallback = ''): string {
  return (process.env[key] ?? '').trim() || fallback
}

// The project's own .env, loaded by hand so this depends on no package.
const envFile = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env')
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, '')
  }
}

const home = os.homedir()

// Under launchd the PATH is minimal (/usr/bin:/bin:/usr/sbin:/sbin) and the
// `claude` binary lives in ~/.local/bin — without this the day's narrative
// would fail silently.
const binaries = [
  path.join(home, '.local', 'bin'),
  path.join(home, 'bin'),
  '/opt/homebrew/bin',
  '/usr/local/bin',
]
const onPath = new Set((process.env.PATH ?? '').split(':'))
const missing = binaries.filter((dir) => !onPath.has(dir) && fs.existsSync(dir))
if (missing.length) process.env.PATH = [...missing, process.env.PATH ?? ''].join(':')

/**
 * Carries a folder over from the name the app had before.
 *
 * The rename is ours, not the user's: nobody should lose months of measurement
 * because the product found a better name. Only moves when the new folder does
 * not exist yet, so it can never overwrite anything.
 */
function carriedOver(parent: string, from: string, to: string): string {
  const target = path.join(parent, to)
  const previous = path.join(parent, from)
  try {
    if (!fs.existsSync(target) && fs.existsSync(previous)) fs.renameSync(previous, target)
  } catch {
    // A failed move is not fatal: the app starts fresh rather than not at all.
  }
  return target
}

const support = path.join(home, 'Library', 'Application Support')
const logs = path.join(home, 'Library', 'Logs')

export const config = {
  home,
  // With no configured name, the macOS account name does: the prompt needs
  // someone to address, and "the computer's memory of " is not a sentence.
  userName: env('USER', os.userInfo().username),
  lang: env('LANG', 'pt-BR'),
  /** The data directory. Everything lives here and nowhere else. */
  dataDir: env('DATA', carriedOver(support, 'Hipocampo', 'Hippocampus')),
  logDir: carriedOver(logs, 'Hipocampo', 'Hippocampus'),
  port: Number(env('PORT', '7878')),
  webPort: Number(env('WEB_PORT', '5179')),
  /** The hour the day turns. Work in the small hours counts as the day before. */
  dayStartHour: Number(env('DAY_START', '4')),
  /** Past this, a block counts as idle and not as active time. */
  idleThreshold: Number(env('IDLE', '120')),
  sampleInterval: Number(env('INTERVAL', '4')),
  /**
   * The Obsidian vault folder. Empty on purpose: with nobody choosing where,
   * the journal simply is not written. Writing into a guess would be creating
   * a file on someone's computer without being invited.
   */
  vault: env('VAULT', ''),
  /** The subfolder of the vault where the day is written. */
  journalFolder: env('JOURNAL', 'Journal'),
  codeRoot: env('CODE', path.join(home, 'Documents', 'GitHub')),
  typesafeKey: plain('TYPESAFE_API_KEY'),
  typesafeModel: plain('TYPESAFE_MODEL', 'jev-latest'),
  openaiKey: plain('OPENAI_API_KEY'),
  openaiBaseUrl: plain('OPENAI_BASE_URL', 'https://api.openai.com/v1'),
  /** The OpenAI voice the core answers with. */
  voice: env('VOICE', 'onyx'),
  claudeModel: env('MODEL', ''),
  /** Keep the typed text (always redacted). Turn it off for numbers only. */
  keepTyping: env('KEEP_TYPING', '1') === '1',
}

/**
 * Where the native helper is.
 *
 * It lives inside a `.app` so it has an identity of its own on macOS — that is
 * what makes the Accessibility grant show up with a name and stick. But the
 * `.app` sits in different places depending on who is running: in the
 * repository it is `native/` next to `core/`; inside the packaged bundle,
 * Electron puts extra resources in `Contents/Resources/`, one level above
 * `app/`. Looking in both is more honest than picking one and breaking
 * silently in the other.
 *
 * Looking costs a trip to disk, which is why it happens the first time someone
 * asks — never on import. The project lives in `~/Documents`, a folder the TCC
 * protects: a background agent that touches it before opening the server ends
 * up waiting on a permission dialog nobody sees, and the whole process freezes
 * without writing a line of log.
 */
let rememberedHelper: string | undefined
function findHelper(): string {
  if (rememberedHelper) return rememberedHelper
  const here = path.dirname(fileURLToPath(import.meta.url))
  const insideTheApp = ['Hippocampus Focus.app', 'Contents', 'MacOS', 'hippocampus-focus']
  const candidates = [
    path.join(here, '..', 'native', ...insideTheApp),        // repository
    path.join(here, '..', '..', 'native', ...insideTheApp),  // packaged bundle
  ]
  rememberedHelper = candidates.find((candidate) => fs.existsSync(candidate)) ?? candidates[0]
  return rememberedHelper
}

export const paths = {
  db: path.join(config.dataDir, 'hippocampus.db'),
  get native() { return findHelper() },
  archive: path.join(config.dataDir, 'archive'),
}

fs.mkdirSync(config.dataDir, { recursive: true })
fs.mkdirSync(config.logDir, { recursive: true })
fs.mkdirSync(paths.archive, { recursive: true })

// The database file is renamed with the app, once, on the first start after
// the rename. Same rule as the folders: only when the new name is still free.
try {
  const previousDb = path.join(config.dataDir, 'hipocampo.db')
  if (!fs.existsSync(paths.db) && fs.existsSync(previousDb)) {
    for (const suffix of ['', '-wal', '-shm']) {
      if (fs.existsSync(previousDb + suffix)) fs.renameSync(previousDb + suffix, paths.db + suffix)
    }
  }
} catch {
  // Same as above: starting fresh beats not starting.
}

/** The day (YYYY-MM-DD) an instant belongs to, respecting dayStartHour. */
export function dayOf(date: Date | number): string {
  const d = typeof date === 'number' ? new Date(date * 1000) : new Date(date)
  const shifted = new Date(d.getTime() - config.dayStartHour * 3600_000)
  const y = shifted.getFullYear()
  const m = String(shifted.getMonth() + 1).padStart(2, '0')
  const day = String(shifted.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function today(): string {
  return dayOf(new Date())
}
