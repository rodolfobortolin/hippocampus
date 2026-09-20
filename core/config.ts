import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

function env(key: string, fallback = ''): string {
  return (process.env[key] ?? '').trim() || fallback
}

// .env do próprio projeto, carregado à mão para não depender de pacote.
const envFile = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env')
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, '')
  }
}

const home = os.homedir()

// Sob o launchd o PATH é mínimo (/usr/bin:/bin:/usr/sbin:/sbin) e o binário do
// `claude` mora em ~/.local/bin — sem isto a narrativa do dia falharia calada.
const binarios = [
  path.join(home, '.local', 'bin'),
  path.join(home, 'bin'),
  '/opt/homebrew/bin',
  '/usr/local/bin',
]
const noPath = new Set((process.env.PATH ?? '').split(':'))
const faltando = binarios.filter((dir) => !noPath.has(dir) && fs.existsSync(dir))
if (faltando.length) process.env.PATH = [...faltando, process.env.PATH ?? ''].join(':')

export const config = {
  home,
  userName: env('HIPOCAMPO_USER', 'Rodolfo'),
  lang: env('HIPOCAMPO_LANG', 'pt-BR'),
  /** Diretório dos dados. Tudo do Hipocampo vive aqui e em lugar nenhum mais. */
  dataDir: env('HIPOCAMPO_DATA', path.join(home, 'Library', 'Application Support', 'Hipocampo')),
  logDir: path.join(home, 'Library', 'Logs', 'Hipocampo'),
  port: Number(env('HIPOCAMPO_PORT', '7878')),
  webPort: Number(env('HIPOCAMPO_WEB_PORT', '5179')),
  /** A hora em que o dia "vira". Trabalho da madrugada conta para o dia anterior. */
  dayStartHour: Number(env('HIPOCAMPO_DAY_START', '4')),
  /** Acima disso o bloco é considerado ocioso e não conta como tempo ativo. */
  idleThreshold: Number(env('HIPOCAMPO_IDLE', '120')),
  sampleInterval: Number(env('HIPOCAMPO_INTERVAL', '4')),
  vault: env('HIPOCAMPO_VAULT', path.join(home, 'Documents', 'GitHub', 'second-brain', 'Second Brain')),
  codeRoot: env('HIPOCAMPO_CODE', path.join(home, 'Documents', 'GitHub')),
  typesafeKey: env('TYPESAFE_API_KEY'),
  typesafeModel: env('TYPESAFE_MODEL', 'jev-latest'),
  openaiKey: env('OPENAI_API_KEY'),
  openaiBaseUrl: env('OPENAI_BASE_URL', 'https://api.openai.com/v1'),
  claudeModel: env('HIPOCAMPO_MODEL', ''),
  /** Guardar o texto digitado (sempre redigido). Desligue se preferir só os números. */
  keepTyping: env('HIPOCAMPO_KEEP_TYPING', '1') === '1',
}

export const paths = {
  db: path.join(config.dataDir, 'hipocampo.db'),
  native: path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'native', 'hipocampo-focus'),
  archive: path.join(config.dataDir, 'archive'),
}

fs.mkdirSync(config.dataDir, { recursive: true })
fs.mkdirSync(config.logDir, { recursive: true })
fs.mkdirSync(paths.archive, { recursive: true })

/** O dia (AAAA-MM-DD) ao qual um instante pertence, respeitando dayStartHour. */
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
