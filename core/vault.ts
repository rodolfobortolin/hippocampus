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
// Exactly as they were written into people's notes, in Portuguese. A rename
// that reaches in here does not fail loudly: `bounds` simply stops finding the
// old section, and the next write appends a second one underneath it.
const OLD_START = '<!-- hipocampo:início -->'
const OLD_END = '<!-- hipocampo:fim -->'

/** The folder where the day is written, created the first time it is needed. */
function journalFolder(): string {
  return path.join(config.vault, config.journalFolder)
}

export function vaultReady(): boolean {
  return Boolean(config.vault) && fs.existsSync(config.vault)
}

/**
 * The markers of a section. The day's own section keeps the markers it has
 * always had; any other — the week's timesheet — is named, so writing one
 * never replaces the other.
 */
function markers(name?: string): [string, string][] {
  return name
    ? [[`<!-- hippocampus:${name}:start -->`, `<!-- hippocampus:${name}:end -->`]]
    : [[START, END], [OLD_START, OLD_END]]
}

/** Where our section begins and ends, under either marker. */
function bounds(text: string, name?: string): { from: number; to: number; end: string } | null {
  for (const [start, end] of markers(name)) {
    const from = text.indexOf(start)
    const to = text.indexOf(end)
    if (from >= 0 && to > from) return { from, to, end }
  }
  return null
}

/**
 * Our section, put back into a note that may already carry one.
 *
 * Whatever the person wrote around it stays exactly where it was: this only
 * ever replaces what sits between our own two markers, and when there is no
 * such pair it appends at the end rather than guessing.
 */
export function replaceSection(text: string, body: string, heading: string, name?: string): string {
  const [start, end] = markers(name)[0]
  const section = `${start}\n\n## ${heading}\n\n${body.trim()}\n\n${end}`
  const found = bounds(text, name)
  return found
    ? text.slice(0, found.from) + section + text.slice(found.to + found.end.length)
    : text.trimEnd() + '\n\n' + section + '\n'
}

export function writeDaySection(day: string, body: string, heading: string, name?: string): string | null {
  if (!vaultReady()) return null
  const folder = journalFolder()
  fs.mkdirSync(folder, { recursive: true })
  const file = path.join(folder, `${day}.md`)

  if (!fs.existsSync(file)) {
    const front = `---\ntype: journal\ndate: ${day}\ntags: [journal]\n---\n\n# ${day}\n\n`
    fs.writeFileSync(file, replaceSection(front, body, heading, name).trimStart())
    return file
  }

  fs.writeFileSync(file, replaceSection(fs.readFileSync(file, 'utf8'), body, heading, name))
  return file
}
