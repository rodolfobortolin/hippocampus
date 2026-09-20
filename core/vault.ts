import fs from 'node:fs'
import path from 'node:path'
import { config } from './config.ts'

/**
 * The vault may already have a journal written by something else. This only
 * ever touches a block of its own, between markers, so it never disturbs what
 * is already there.
 *
 * The old marker is still recognised when reading. It is sitting inside notes
 * people already have, and renaming the app is no reason to orphan a section
 * and start writing a second one below it.
 */
const START = '<!-- hippocampus:start -->'
const END = '<!-- hippocampus:end -->'
const OLD_START = '<!-- hipocampo:início -->'
const OLD_END = '<!-- hipocampo:end -->'

/** The folder where the day is written, created the first time it is needed. */
function journalFolder(): string {
  return path.join(config.vault, config.journalFolder)
}

export function vaultReady(): boolean {
  return Boolean(config.vault) && fs.existsSync(config.vault)
}

/** Where our section begins and ends, under either marker. */
function bounds(text: string): { from: number; to: number; end: string } | null {
  for (const [start, end] of [[START, END], [OLD_START, OLD_END]] as const) {
    const from = text.indexOf(start)
    const to = text.indexOf(end)
    if (from >= 0 && to > from) return { from, to, end }
  }
  return null
}

export function writeDaySection(day: string, body: string, heading: string): string | null {
  if (!vaultReady()) return null
  const folder = journalFolder()
  fs.mkdirSync(folder, { recursive: true })
  const file = path.join(folder, `${day}.md`)
  const section = `${START}\n\n## ${heading}\n\n${body.trim()}\n\n${END}`

  if (!fs.existsSync(file)) {
    const front = `---\ntype: journal\ndate: ${day}\ntags: [journal]\n---\n\n# ${day}\n\n`
    fs.writeFileSync(file, front + section + '\n')
    return file
  }

  const current = fs.readFileSync(file, 'utf8')
  const found = bounds(current)
  const next = found
    ? current.slice(0, found.from) + section + current.slice(found.to + found.end.length)
    : current.trimEnd() + '\n\n' + section + '\n'
  fs.writeFileSync(file, next)
  return file
}
