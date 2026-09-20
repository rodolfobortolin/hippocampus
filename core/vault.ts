import fs from 'node:fs'
import path from 'node:path'
import { config } from './config.ts'

// O diário do vault é escrito pelo Jarvis. O Hipocampo só cuida de um bloco
// próprio, entre marcadores, para nunca encostar no que já está lá.
const START = '<!-- hipocampo:início -->'
const END = '<!-- hipocampo:fim -->'

export function vaultReady(): boolean {
  return fs.existsSync(path.join(config.vault, '10 Diário'))
}

export function writeDaySection(day: string, body: string): string | null {
  if (!vaultReady()) return null
  const file = path.join(config.vault, '10 Diário', `${day}.md`)
  const section = `${START}\n\n## No computador\n\n${body.trim()}\n\n${END}`

  if (!fs.existsSync(file)) {
    const front = `---\ntipo: diário\ndata: ${day}\ntags: [diário]\n---\n\n# ${day}\n\n`
    fs.writeFileSync(file, front + section + '\n')
    return file
  }

  const current = fs.readFileSync(file, 'utf8')
  const from = current.indexOf(START)
  const to = current.indexOf(END)
  const next = from >= 0 && to > from
    ? current.slice(0, from) + section + current.slice(to + END.length)
    : current.trimEnd() + '\n\n' + section + '\n'
  fs.writeFileSync(file, next)
  return file
}
