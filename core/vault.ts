import fs from 'node:fs'
import path from 'node:path'
import { config } from './config.ts'
import { VAULT_HEADING, TIMESHEET_HEADING } from './languages.ts'

/**
 * The vault may already have a journal written by something else. This only
 * ever touches a block of its own, between markers, so it never disturbs what
 * is already there.
 *
 * The heading comes first and the markers sit under it, inside the section.
 * Other tools read a note by its headings — a section runs from one `##` to
 * the next — and with the marker above the heading it belonged, for them, to
 * the section before ours: an Obsidian plugin appending to that section wrote
 * inside our block, and the next write here erased what it had added.
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

/**
 * A day's note as the vault itself would create it.
 *
 * Obsidian keeps the daily note's template in `.obsidian/daily-notes.json`,
 * and everything else in the vault is made from it: the same properties, the
 * same headings. Writing a note of our own invention instead left the days
 * nobody else touched out of every search that asks for the person's own
 * kind of note. With no template configured, a plain one.
 */
function newNote(day: string): string {
  try {
    const settings = JSON.parse(fs.readFileSync(path.join(config.vault, '.obsidian', 'daily-notes.json'), 'utf8'))
    const template = String(settings.template ?? '').replace(/\.md$/, '')
    if (template) {
      const raw = fs.readFileSync(path.join(config.vault, `${template}.md`), 'utf8')
      return raw
        .replaceAll('{{date}}', day)
        .replaceAll('{{title}}', day)
        .replaceAll('{{time}}', new Date().toTimeString().slice(0, 5))
    }
  } catch {
    // No Obsidian folder, no daily note settings, no template: a plain note.
  }
  return `---\ntype: journal\ndate: ${day}\ntags: [journal]\n---\n\n# ${day}\n\n`
}

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
  const section = `## ${heading}\n\n${start}\n\n${body.trim()}\n\n${end}`
  const found = bounds(text, name)
  if (!found) return text.trimEnd() + '\n\n' + section + '\n'
  // The heading above the marker is ours as well — from a note written before
  // the heading moved inside, or from the last write. Without taking it with
  // the block, each write would leave another heading behind.
  return text.slice(0, headingAbove(text, found.from, heading)).trimEnd() + '\n\n'
    + section + text.slice(found.to + found.end.length)
}

/**
 * Where our section really starts: at the heading just above the marker, when
 * that heading is one of ours.
 *
 * Only ours. A note written under the old shape has the marker under the
 * previous section's heading, and taking whatever sits above would delete
 * somebody else's heading — an empty "Captures" vanished from a real note
 * exactly that way.
 */
const OURS = new Set([...Object.values(VAULT_HEADING), ...Object.values(TIMESHEET_HEADING)])

function headingAbove(text: string, marker: number, heading: string): number {
  const before = text.slice(0, marker).replace(/\s+$/, '')
  const line = before.slice(before.lastIndexOf('\n') + 1)
  const title = /^##\s+(\S.*)$/.exec(line)?.[1]?.trim()
  // The one being written now, or one we would have written in another
  // language — somebody switches language and the old heading is still ours.
  return title && (title === heading.trim() || OURS.has(title)) ? before.length - line.length : marker
}

export function writeDaySection(day: string, body: string, heading: string, name?: string): string | null {
  if (!vaultReady()) return null
  const folder = journalFolder()
  fs.mkdirSync(folder, { recursive: true })
  const file = path.join(folder, `${day}.md`)

  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, replaceSection(newNote(day), body, heading, name).trimStart())
    return file
  }

  fs.writeFileSync(file, replaceSection(fs.readFileSync(file, 'utf8'), body, heading, name))
  return file
}
