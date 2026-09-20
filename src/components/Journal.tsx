import { useEffect, useState } from 'react'
import { api, type StoredDay, type Status } from '../lib/api.ts'
import { duration, longDate, addDays, today as diaDeHoje } from '../lib/format.ts'
import { Markdown } from '../lib/markdown.tsx'
import { useLanguage } from '../lib/language.tsx'
import { IconOpen } from './Icons.tsx'

type Row = { day: string; active: number; saved?: StoredDay }

export function Journal({ status }: { status: Status | null }) {
  const t = useLanguage().t
  const [rows, setRows] = useState<Row[]>([])
  const [openedAt, setAberto] = useState<string | null>(null)
  const [gerando, setGerando] = useState<string | null>(null)
  const [error, setErro] = useState('')

  const load = async () => {
    const to = diaDeHoje()
    const [period, salvos] = await Promise.all([api.period(addDays(to, -89), to), api.days()])
    const porDia = new Map(salvos.map((s) => [s.day, s]))
    const days = new Map<string, Row>()
    for (const day of period.days) days.set(day.day, { day: day.day, active: day.active, saved: porDia.get(day.day) })
    for (const saved of salvos) if (!days.has(saved.day)) days.set(saved.day, { day: saved.day, active: saved.active_seconds, saved })
    setRows([...days.values()].sort((a, b) => b.day.localeCompare(a.day)))
  }

  useEffect(() => { load().catch((e) => setErro(e.message)) }, [])

  const generate = async (day: string) => {
    setGerando(day)
    setErro('')
    try {
      await api.close(day, true)
      await load()
      setAberto(day)
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setGerando(null)
    }
  }

  return (
    <>
      <div className="top">
        <div>
          <h2><b>{t.journal.title}</b></h2>
          <p>{t.journal.subtitle}</p>
        </div>
      </div>

      {status && !status.claude && (
        <div className="warning">
          <div>
            <p><strong>{t.journal.claudeDidNotAnswer}</strong> {t.journal.claudeText}</p>
          </div>
        </div>
      )}

      {error && <div className="warning"><div><p>{error}</p></div></div>}

      {!rows.length ? (
        <div className="panel" style={{ padding: '40px 20px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-mid)' }}>{t.journal.noDays}</p>
          <p className="note">{t.journal.fillsTomorrow}</p>
        </div>
      ) : (
        <div className="grid" style={{ gap: 10 }}>
          {rows.map((linha) => {
            const isOpen = openedAt === linha.day
            return (
              <div key={linha.day} className="day-card">
                <button className="day-head" onClick={() => setAberto(isOpen ? null : linha.day)}>
                  <span style={{
                    transform: isOpen ? 'rotate(90deg)' : 'none',
                    transition: 'transform .2s', color: 'var(--text-dim)', display: 'grid',
                  }}>
                    <IconOpen />
                  </span>
                  <span className="date">
                    {linha.day}
                    <span>{longDate(linha.day)}</span>
                  </span>
                  <span style={{ color: 'var(--gold)', fontVariantNumeric: 'tabular-nums', minWidth: 68 }}>
                    {duration(linha.active)}
                  </span>
                  <span style={{ flex: 1, color: 'var(--text-dim)', fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {linha.saved?.narrative
                      ? linha.saved.narrative.replace(/[*#-]/g, '').trim().slice(0, 110)
                      : linha.saved?.top_app ?? t.journal.notWritten}
                  </span>
                </button>

                {isOpen && (
                  <div className="day-body appear">
                    {linha.saved?.narrative ? (
                      <>
                        <h4>{t.journal.daySummary}</h4>
                        <div className="message theirs"><Markdown text={linha.saved.narrative} /></div>
                        {linha.saved.recap && (
                          <>
                            <h4>{t.journal.theRecap}</h4>
                            <div className="message theirs"><Markdown text={linha.saved.recap} /></div>
                          </>
                        )}
                        <button
                          onClick={() => generate(linha.day)}
                          disabled={gerando === linha.day}
                          style={{
                            marginTop: 18, padding: '7px 13px', borderRadius: 9, fontSize: 12.5,
                            border: '1px solid var(--border)', color: 'var(--text-mid)',
                          }}>
                          {gerando === linha.day ? t.journal.rewriting : t.journal.rewrite}
                        </button>
                      </>
                    ) : (
                      <div style={{ paddingTop: 16 }}>
                        <p style={{ color: 'var(--text-mid)', fontSize: 13 }}>{t.journal.notWrittenYet}</p>
                        <button
                          onClick={() => generate(linha.day)}
                          disabled={gerando === linha.day || !status?.claude}
                          style={{
                            marginTop: 12, padding: '8px 15px', borderRadius: 9, fontSize: 13,
                            border: '1px solid rgba(255,209,102,.35)', color: 'var(--gold)',
                          }}>
                          {gerando === linha.day ? t.journal.writing : t.journal.writeThisDay}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
