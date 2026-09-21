import { useEffect, useRef, useState } from 'react'
import { api, type Capture, type Captured, type NoteKind, type NotesView } from '../lib/api.ts'
import { useLanguage } from '../lib/language.tsx'

const KINDS: NoteKind[] = ['project', 'knowledge', 'person', 'area', 'inbox']

/**
 * What outlives the day.
 *
 * The journal is written for you, once, at the turn of the day. This is the
 * other half: what you decide is worth keeping, written in your words, into
 * the note that already carries the subject — or into a new one, born from the
 * vault's own template.
 */
export function Notes() {
  const { t } = useLanguage()
  const [kind, setKind] = useState<NoteKind>('project')
  const [view, setView] = useState<NotesView | null>(null)
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<Captured | null>(null)
  const [error, setError] = useState('')
  const writing = useRef<HTMLTextAreaElement>(null)
  const [written, setWritten] = useState<Capture[]>([])
  const [reading, setReading] = useState(false)

  // Yesterday: the last day that closed, and so the last one the curator read.
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)

  const load = (which: NoteKind) => api.notes(which).then(setView).catch((e) => setError(e.message))
  useEffect(() => { load(kind) }, [kind])
  useEffect(() => {
    api.captures(yesterday).then((r) => setWritten(r.captures)).catch(() => setWritten([]))
  }, [])

  // Reading a day that closed before this existed, or one worth rereading.
  const readDay = async () => {
    setReading(true)
    setError('')
    try {
      const result = await api.curate(yesterday, true)
      setWritten(result.captures)
      await load(kind)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setReading(false)
    }
  }

  const folder = view?.folders.find((f) => f.kind === kind)
  const known = view?.titles ?? []
  // The note it will land in, if it is one that already exists.
  const hits = title.trim()
    ? known.filter((name) => name.toLowerCase() === title.trim().toLowerCase())
    : []

  const keep = async () => {
    if (!title.trim() || !text.trim() || saving) return
    setSaving(true)
    setError('')
    try {
      const result = await api.capture({ kind, title: title.trim(), text: text.trim() })
      if (result.error) throw new Error(result.error)
      setSaved(result)
      setText('')
      await load(kind)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="top">
        <div>
          <h2><b>{t.notes.title}</b></h2>
          <p>{t.notes.subtitle}</p>
        </div>
      </div>

      {view && !view.vault ? (
        <div className="panel" style={{ padding: '40px 20px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-mid)' }}>{t.notes.noVault}</p>
          <p className="note">{t.notes.noVaultHow}</p>
        </div>
      ) : (
        <div className="grid" style={{ gap: 14 }}>
          <div className="panel capture">
            <div className="kinds">
              {KINDS.map((option) => (
                <button
                  key={option}
                  className={`pill ${option === kind ? 'active' : ''}`}
                  onClick={() => { setKind(option); setSaved(null) }}>
                  {t.notes.kinds[option]}
                </button>
              ))}
            </div>
            <p className="note" style={{ marginTop: 0 }}>{t.notes.hints[kind]}</p>

            <input
              list="known-notes"
              value={title}
              placeholder={t.notes.titlePlaceholder}
              aria-label={t.notes.titleField}
              onChange={(e) => { setTitle(e.target.value); setSaved(null) }}
              onKeyDown={(e) => { if (e.key === 'Enter') writing.current?.focus() }}
            />
            <datalist id="known-notes">
              {known.map((name) => <option key={name} value={name} />)}
            </datalist>

            <textarea
              ref={writing}
              value={text}
              rows={4}
              placeholder={t.notes.textPlaceholder}
              onChange={(e) => { setText(e.target.value); setSaved(null) }}
              // Enter breaks the line, as it should in a note; the shortcut keeps it.
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void keep() }}
            />

            <div className="capture-foot">
              <span className="note" style={{ margin: 0 }}>
                {/* Where it is going, before it goes — and whether that folder
                    is about to exist for the first time. */}
                {t.notes.goesTo} <code>{folder?.folder}/{(title.trim() || '…')}.md</code>
                {folder && !folder.exists && <> · {t.notes.folderIsNew}</>}
                {hits.length > 0 && <> · {t.notes.existing}</>}
              </span>
              <button
                className="keep"
                onClick={() => void keep()}
                disabled={saving || !title.trim() || !text.trim()}>
                {saving ? t.notes.saving : t.notes.save}
              </button>
            </div>

            {error && <p className="note" style={{ color: 'var(--communication)' }}>{error}</p>}
            {saved && !error && (
              <p className="note appear">
                {/* The note as the vault names it. The absolute path is true
                    and unreadable — it says /private/tmp before it says which
                    note was written. */}
                {saved.created ? t.notes.created : t.notes.appended}{' '}
                <code>{saved.file.split('/').slice(-2).join('/')}</code>
                {saved.section && <> · {t.notes.inSection} <b>{saved.section}</b></>}
              </p>
            )}
          </div>

          {/* What the close of the day kept on its own. This is the half that
              does not depend on anyone remembering to write. */}
          <div className="panel">
            <h3>
              {t.notes.written} <em>{yesterday}</em>
            </h3>
            <p className="note" style={{ marginTop: 6 }}>{t.notes.writtenNote}</p>
            {written.length === 0 ? (
              <div className="capture-foot" style={{ marginTop: 12 }}>
                <span className="note" style={{ margin: 0 }}>{t.notes.nothingWritten}</span>
                <button className="keep" onClick={() => void readDay()} disabled={reading}>
                  {reading ? t.notes.running : t.notes.runNow}
                </button>
              </div>
            ) : (
              <div className="kept">
                {written.map((note) => (
                  <div key={`${note.kind}-${note.title}`}>
                    <span className="of">{t.notes.kinds[note.kind]}</span>
                    <span className="title" title={note.title}>{note.title}</span>
                    <span className="fresh">{note.created === 1 ? t.notes.isNew : ''}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="panel">
            <h3>{t.notes.existing} <em>{folder?.folder}</em></h3>
            {known.length === 0 ? (
              <p className="note">{t.notes.noneYet}</p>
            ) : (
              <div className="kinds" style={{ marginTop: 12 }}>
                {known.map((name) => (
                  <button
                    key={name}
                    className={`pill ${name.toLowerCase() === title.trim().toLowerCase() ? 'active' : ''}`}
                    onClick={() => { setTitle(name); setSaved(null); writing.current?.focus() }}>
                    {name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
