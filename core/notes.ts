import fs from 'node:fs'
import path from 'node:path'
import { config } from './config.ts'
import { LANGUAGES, validLanguage, type Language } from './languages.ts'

/**
 * The notes that outlive a day: a project, something learned, a person, an
 * area, a loose thought.
 *
 * The journal (core/vault.ts) writes one section of one note per day, between
 * markers, and owns it. These are the opposite: they are the person's own
 * notes, written over months, and this only ever adds a line or a paragraph to
 * one of their sections. Nothing here replaces text it did not write.
 */

export type NoteKind = 'project' | 'knowledge' | 'person' | 'area' | 'inbox'

export const NOTE_KINDS: NoteKind[] = ['project', 'knowledge', 'person', 'area', 'inbox']

/**
 * What each kind's folder is called, per language, and the number that keeps
 * the vault in order — the same shape a Zettelkasten-ish vault already uses.
 *
 * These are only defaults, for a vault that has no such folder yet. A vault
 * that already has one wins, whatever language it is in: someone who keeps
 * their notes in Portuguese and runs the app in English must not end up with
 * "20 Projetos" and "20 Projects" side by side.
 */
const FOLDERS: Record<Language, Record<NoteKind | 'templates', string>> = {
  'pt-BR': {
    inbox: '00 Inbox', area: '30 Áreas', project: '20 Projetos',
    knowledge: '40 Conhecimento', person: '50 Pessoas', templates: '90 Templates',
  },
  'en-US': {
    inbox: '00 Inbox', area: '30 Areas', project: '20 Projects',
    knowledge: '40 Knowledge', person: '50 People', templates: '90 Templates',
  },
  'es-ES': {
    inbox: '00 Entrada', area: '30 Áreas', project: '20 Proyectos',
    knowledge: '40 Conocimiento', person: '50 Personas', templates: '90 Plantillas',
  },
  'fr-FR': {
    inbox: '00 Boîte de réception', area: '30 Domaines', project: '20 Projets',
    knowledge: '40 Connaissances', person: '50 Personnes', templates: '90 Modèles',
  },
  'de-DE': {
    inbox: '00 Eingang', area: '30 Bereiche', project: '20 Projekte',
    knowledge: '40 Wissen', person: '50 Personen', templates: '90 Vorlagen',
  },
}

/** The template note each kind is born from, when the vault has one. */
const TEMPLATES: Record<Language, Record<NoteKind, string>> = {
  'pt-BR': { project: 'Projeto', knowledge: 'Conhecimento', person: 'Pessoa', area: 'Área', inbox: 'Inbox' },
  'en-US': { project: 'Project', knowledge: 'Knowledge', person: 'Person', area: 'Area', inbox: 'Inbox' },
  'es-ES': { project: 'Proyecto', knowledge: 'Conocimiento', person: 'Persona', area: 'Área', inbox: 'Entrada' },
  'fr-FR': { project: 'Projet', knowledge: 'Connaissance', person: 'Personne', area: 'Domaine', inbox: 'Boîte' },
  'de-DE': { project: 'Projekt', knowledge: 'Wissen', person: 'Person', area: 'Bereich', inbox: 'Eingang' },
}

/**
 * Where a new line lands inside an existing note, per kind and per language.
 *
 * The first name is the one written into a note that has no such section; the
 * others are recognised when they are already there. A note keeps the heading
 * it was born with even if the app's language changes later.
 */
const SECTIONS: Record<Language, Record<NoteKind, string[]>> = {
  'pt-BR': {
    project: ['Histórico', 'Log', 'Notas'], knowledge: ['Detalhes', 'Notas'],
    person: ['Interações', 'Notas'], area: ['Notas'], inbox: [],
  },
  'en-US': {
    project: ['History', 'Log', 'Notes'], knowledge: ['Details', 'Notes'],
    person: ['Interactions', 'Notes'], area: ['Notes'], inbox: [],
  },
  'es-ES': {
    project: ['Histórico', 'Registro', 'Notas'], knowledge: ['Detalles', 'Notas'],
    person: ['Interacciones', 'Notas'], area: ['Notas'], inbox: [],
  },
  'fr-FR': {
    project: ['Historique', 'Journal', 'Notes'], knowledge: ['Détails', 'Notes'],
    person: ['Interactions', 'Notes'], area: ['Notes'], inbox: [],
  },
  'de-DE': {
    project: ['Verlauf', 'Protokoll', 'Notizen'], knowledge: ['Details', 'Notizen'],
    person: ['Begegnungen', 'Notizen'], area: ['Notizen'], inbox: [],
  },
}

/**
 * The front matter of a note born without a template, in the language the
 * vault is being written in. A Portuguese vault that gets `type: knowledge`
 * falls out of every search the person already had.
 */
const FRONT: Record<Language, { type: string; created: string }> = {
  'pt-BR': { type: 'tipo', created: 'criado' },
  'en-US': { type: 'type', created: 'created' },
  'es-ES': { type: 'tipo', created: 'creado' },
  'fr-FR': { type: 'type', created: 'créé' },
  'de-DE': { type: 'typ', created: 'erstellt' },
}

/** Sections that read as a timeline: there, a line is stamped with its date. */
const DATED = new Set(
  Object.values(SECTIONS).flatMap((byKind) => [...byKind.project, ...byKind.person])
    .map(normal))

/** Lowercase, without accents and without the ordering number in front. */
function normal(name: string): string {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/^\d+\s+/, '').trim().toLowerCase()
}

const language = (): Language => validLanguage(config.lang)

/** Every name a kind's folder may already have, in any of the languages. */
function knownNames(kind: NoteKind | 'templates'): Set<string> {
  return new Set(Object.keys(LANGUAGES).map((l) => normal(FOLDERS[l as Language][kind])))
}

function folders(): string[] {
  try {
    return fs.readdirSync(config.vault, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
      .map((e) => e.name)
  } catch {
    return []
  }
}

/**
 * The folder a kind belongs in: the one the vault already has, whatever
 * language named it, and otherwise the default for the language in use.
 *
 * Nothing is created here. A folder appears on disk the first time something
 * is actually written into it — a vault that gets five empty folders for a
 * feature the person never used is a vault we damaged.
 */
export function folderFor(kind: NoteKind | 'templates'): string {
  const wanted = knownNames(kind)
  const existing = folders().find((name) => wanted.has(normal(name)))
  return existing ?? FOLDERS[language()][kind]
}

export function noteFolders(): { kind: NoteKind; folder: string; exists: boolean }[] {
  return NOTE_KINDS.map((kind) => {
    const folder = folderFor(kind)
    return { kind, folder, exists: fs.existsSync(path.join(config.vault, folder)) }
  })
}

/** A title that is safe as a file name, and still reads like the title. */
export function safeName(title: string): string {
  return title.replace(/^\[\[|\]\]$/g, '').split('|')[0]
    .replace(/[\\/:*?"<>|#^[\]]/g, ' ')
    // A run of dots is how a path walks out of its folder, and a name that
    // starts with one is a file the person cannot see in Finder.
    .replace(/\.{2,}/g, ' ')
    .replace(/(^|\s)\.+/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100)
}

export function listNotes(kind: NoteKind): string[] {
  try {
    return fs.readdirSync(path.join(config.vault, folderFor(kind)))
      .filter((name) => name.endsWith('.md'))
      .map((name) => name.slice(0, -3))
      .sort((a, b) => a.localeCompare(b))
  } catch {
    return []
  }
}

/**
 * The note that already carries this title, inside that kind's folder only.
 *
 * Only inside it: the project "Jarvis" must never land in the `JARVIS.md` that
 * sits at the root of the vault explaining the conventions.
 */
function noteAt(kind: NoteKind, title: string): string | null {
  const folder = path.join(config.vault, folderFor(kind))
  const wanted = normal(safeName(title))
  try {
    const found = fs.readdirSync(folder)
      .find((name) => name.endsWith('.md') && normal(name.slice(0, -3)) === wanted)
    return found ? path.join(folder, found) : null
  } catch {
    return null
  }
}

function template(kind: NoteKind, title: string, day: string): string | null {
  const folder = path.join(config.vault, folderFor('templates'))
  const wanted = new Set(Object.keys(LANGUAGES).map((l) => normal(TEMPLATES[l as Language][kind])))
  try {
    const file = fs.readdirSync(folder)
      .find((name) => name.endsWith('.md') && wanted.has(normal(name.slice(0, -3))))
    if (!file) return null
    return fs.readFileSync(path.join(folder, file), 'utf8')
      .replaceAll('{{title}}', title)
      .replaceAll('{{date}}', day)
      .replaceAll('{{time}}', new Date().toTimeString().slice(0, 5))
  } catch {
    return null
  }
}

/** Where our own blocks are, so a capture never lands inside one. */
function ourBlocks(text: string): [number, number][] {
  const spans: [number, number][] = []
  const marker = /<!--\s*(?:hippocampus|hipocampo)[^>]*?(?:start|início)\s*-->/g
  for (let m = marker.exec(text); m; m = marker.exec(text)) {
    const close = /<!--\s*(?:hippocampus|hipocampo)[^>]*?(?:end|fim)\s*-->/g
    close.lastIndex = m.index
    const found = close.exec(text)
    if (found) spans.push([m.index, found.index + found[0].length])
  }
  return spans
}

function outsideOurs(text: string, at: number): number {
  for (const [from, to] of ourBlocks(text)) if (at > from && at <= to) return to
  return at
}

/**
 * Every name that section can have, in any language.
 *
 * A note carries the heading it was born with — "Interações" — and the app may
 * be in English by the time the next line is written. Looking only for the
 * current language's name opened a second "Interactions" right underneath.
 */
function everyName(kind: NoteKind): string[] {
  return [...new Set(Object.keys(LANGUAGES).flatMap((l) => SECTIONS[l as Language][kind]))]
}

/** The heading of the note's section this kind writes into, if it has one. */
function sectionIn(text: string, names: string[]): string | null {
  const wanted = new Set(names.map(normal))
  for (const line of text.split('\n')) {
    const title = /^##\s+(\S.*)$/.exec(line)?.[1]?.trim()
    if (title && wanted.has(normal(title))) return title
  }
  return null
}

/**
 * One more line under a heading, at the end of what is already there.
 *
 * The section ends where the next `##` begins, so the line goes just above it
 * and not at the end of the note — which is what makes a capture land in the
 * right place two years into a note's life.
 */
export function appendUnder(text: string, heading: string, body: string): string {
  const head = new RegExp(`^##\\s+${heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'm')
  const found = head.exec(text)
  if (!found) {
    return `${text.trimEnd()}\n\n## ${heading}\n\n${body.trim()}\n`
  }
  const from = found.index + found[0].length
  const next = /^##\s+/m.exec(text.slice(from))
  const at = outsideOurs(text, next ? from + next.index : text.length)
  const before = text.slice(0, at).trimEnd()
  // A heading is followed by a blank line; a list item is followed by the next
  // item, tight — which is how the person's own notes are already written.
  const last = before.slice(before.lastIndexOf('\n') + 1)
  const glue = /^[-*+]\s|^\d+\.\s/.test(last) && /^[-*+]\s/.test(body.trim()) ? '\n' : '\n\n'
  return `${before}${glue}${body.trim()}\n\n${text.slice(at).trimStart()}`.trimEnd() + '\n'
}

export type Capture = {
  kind: NoteKind
  title: string
  text: string
  /** A heading of the person's choosing; the kind's own is used without one. */
  section?: string
  day?: string
}

export type Captured = { file: string; created: boolean; section: string | null }

/**
 * A note kept, or a line added to the one that is already there.
 *
 * The folder is created here and only here, on the first capture of that kind.
 */
export function capture(input: Capture): Captured {
  const title = safeName(input.title)
  const text = input.text.trim()
  if (!config.vault || !fs.existsSync(config.vault)) throw new Error('no vault')
  if (!title) throw new Error('a note needs a title')
  if (!text) throw new Error('a note needs something written in it')

  const day = input.day ?? new Date().toISOString().slice(0, 10)
  const lang = language()
  // What to look for is every language's name; what to write, when the note
  // has none of them, is the one in the language being used now.
  const known = input.section ? [input.section] : everyName(input.kind)
  const mine = input.section ?? SECTIONS[lang][input.kind][0]
  const existing = noteAt(input.kind, title)

  if (existing) {
    const note = fs.readFileSync(existing, 'utf8')
    const heading = known.length ? sectionIn(note, known) ?? mine : null
    const line = heading && DATED.has(normal(heading)) ? `- **${day}** — ${text}` : text
    fs.writeFileSync(existing, heading ? appendUnder(note, heading, line) : `${note.trimEnd()}\n\n${text}\n`)
    return { file: existing, created: false, section: heading }
  }

  const folder = path.join(config.vault, folderFor(input.kind))
  fs.mkdirSync(folder, { recursive: true })
  const file = path.join(folder, `${title}.md`)
  const front = FRONT[lang]
  const born = template(input.kind, title, day)
    ?? `---\n${front.type}: ${TEMPLATES[lang][input.kind].toLowerCase()}\n${front.created}: ${day}\n---\n\n# ${title}\n`
  // A new note goes into the section the template already opens, when it has
  // one, so the text is not stranded above the shape of the note.
  const heading = known.length ? sectionIn(born, known) ?? /^##\s+(\S.*)$/m.exec(born)?.[1]?.trim() ?? mine : null
  const line = heading && DATED.has(normal(heading)) ? `- **${day}** — ${text}` : text
  fs.writeFileSync(file, heading ? appendUnder(born, heading, line) : `${born.trimEnd()}\n\n${text}\n`)
  return { file, created: true, section: heading }
}
