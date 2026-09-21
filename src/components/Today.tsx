import { useEffect, useState } from 'react'
import { api, type Day, type Status } from '../lib/api.ts'
import { duration, hours, clock, longDate, addDays, today as todayString, colour, number, topSlices, plural } from '../lib/format.ts'
import { useLanguage } from '../lib/language.tsx'
import { Donut, Ribbon, Gauge, Bars, FocusShape } from './charts.tsx'
import { IconAlert } from './Icons.tsx'

function Card({ rotulo, children, nota }: { rotulo: string; children: React.ReactNode; nota?: string }) {
  return (
    <div className="panel">
      <div className="label">{rotulo}</div>
      {children}
      {nota && <div className="note">{nota}</div>}
    </div>
  )
}

/** The Electron bridge, absent when the interface runs in a plain browser. */
const bridge = (globalThis as any).hippocampus as {
  openAccessibility?: () => void
} | undefined

export function Today({ status }: { status: Status | null }) {
  const { t, category } = useLanguage()
  const [day, setDay] = useState(todayString())
  const [data, setData] = useState<Day | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    const load = () => api.day(day).then((d) => alive && setData(d)).catch((e) => alive && setError(e.message))
    load()
    // Enquanto é today, a canvas follow o que está sendo medido now.
    const timer = day === todayString() ? setInterval(load, 20_000) : null
    return () => { alive = false; if (timer) clearInterval(timer) }
  }, [day])

  if (error) return <p className="empty">{t.status.noCore} {error}</p>
  if (!data) return <p className="empty">{t.today.loading}</p>

  const isToday = day === todayString()
  const active = hours(data.activeSeconds)
  const noData = data.activeSeconds < 60
  const topCategory = data.categories[0]

  return (
    <>
      <div className="top">
        <div>
          <h2>{isToday ? <b>{t.today.today}</b> : <b>{longDate(day)}</b>}</h2>
          <p>
            {isToday && <>{longDate(day)} · </>}
            {data.firstAt
              ? `${t.today.from} ${clock(data.firstAt)} ${t.today.to} ${clock(data.lastAt)}`
              : data.idleSeconds > 60
                ? `${duration(data.idleSeconds)} ${t.today.idleMachine}`
                : t.today.nothingMeasured}
          </p>
        </div>
        <div className="nav">
          <button onClick={() => setDay(addDays(day, -1))}>{t.today.previousDay}</button>
          <button onClick={() => setDay(todayString())} disabled={isToday} className={isToday ? 'active' : ''}>
            {t.today.todayButton}
          </button>
          <button onClick={() => setDay(addDays(day, 1))} disabled={isToday}>{t.today.nextDay}</button>
        </div>
      </div>

      {/* Only when the helper has actually said it lacks the permission. While
          it is still `null` nobody knows yet, and a warning that takes itself
          back fifteen seconds later teaches people to ignore warnings. */}
      {status?.collector.trusted === false && (
        <div className="warning">
          <IconAlert />
          <div>
            <p><strong>{t.today.missingAccessibility}</strong> {t.today.missingAccessibilityText}</p>
            {bridge?.openAccessibility && (
              <button className="pill" style={{ marginTop: 10, cursor: 'pointer' }}
                onClick={() => bridge.openAccessibility?.()}>
                {t.today.openAccessibility}
              </button>
            )}
          </div>
        </div>
      )}

      {noData ? (
        <div className="panel" style={{ padding: '40px 20px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-mid)' }}>
            {data.idleSeconds > 60
              ? `${t.today.measuringNoActivity} ${duration(data.idleSeconds)} ${t.today.idleMachine}.`
              : `${t.today.nothingMeasured}.`}
          </p>
          <p className="note">
            {data.idleSeconds > 60
              ? t.today.backToKeyboard
              : isToday ? t.today.collectorRecords : t.today.onlySees}
          </p>
        </div>
      ) : (
        <div className="grid" style={{ gap: 14 }}>
          <div className="grid g5">
            <Card rotulo={t.today.yourTime}
              nota={data.awaySeconds > 60 ? `${duration(data.awaySeconds)} ${t.today.awayFromMachine}` : undefined}>
              <div className="number glow">{active.value}<small>{active.unit}</small></div>
            </Card>

            <Card rotulo={t.today.delegated}
              nota={data.delegatedSeconds > 60 ? t.today.delegatedNote : t.today.noDelegated}>
              <div className="number" style={{ color: 'var(--ai)', textShadow: '0 0 26px rgba(167,139,250,.35)' }}>
                {hours(data.delegatedSeconds).value}
                <small>{hours(data.delegatedSeconds).unit}</small>
              </div>
            </Card>

            <div className="panel">
              <div className="label">{t.today.focused}</div>
              <Gauge value={data.focusRatio} seconds={data.focusSeconds} />
              <div className="note">{t.today.focusedNote}</div>
            </div>

            <Card rotulo={t.today.switches} nota={t.today.switchesNote(data.switchesProject)}>
              <div className="number">{number(data.switches)}</div>
            </Card>

            <Card rotulo={t.today.dominated}
              nota={topCategory
                ? `${duration(data.apps[0]?.seconds ?? 0)} · ${t.today.biggestSlice} ${category(topCategory.name)}, ${duration(topCategory.seconds)}`
                : undefined}>
              <div className="number" style={{ fontSize: 26, letterSpacing: '-0.6px', paddingTop: 8 }}>
                {data.apps[0]?.name ?? '—'}
              </div>
            </Card>
          </div>

          <div className="panel">
            <h3>
              {t.today.ribbon}
              <em>
                {plural(data.timeline.length, t.counts.stretch)}
                {data.timelineHidden > 0 && ` · ${number(data.timelineHidden)} ${t.today.tooShort}`}
              </em>
            </h3>
            <Ribbon blocks={data.timeline} day={day} />
            <div className="legend">
              {data.categories.slice(0, 8).map((c) => (
                <span key={c.name} className="pill">
                  <i style={{ background: colour(c.name) }} />{category(c.name)}
                </span>
              ))}
            </div>
          </div>

          <div className="grid g32">
            <div className="panel">
              <h3>{t.today.focusShape}<em>{plural(data.focusShape.sessions, t.counts.session)}</em></h3>
              <FocusShape bands={data.focusShape.bands} median={data.focusShape.median} largest={data.focusShape.longest} />
              <div className="note">{t.today.shapeNote}</div>
            </div>
            <div className="panel">
              <h3>{t.today.byCategory}</h3>
              <Donut slices={data.categories} total={data.activeSeconds} />
            </div>
          </div>

          <div className="grid g32">
            <div className="panel">
              <h3>{t.today.whereTimeWent}</h3>
              <Bars items={topSlices(data.apps)} total={data.activeSeconds} tone="var(--ember)" />
            </div>
            <div className="panel">
              <h3>{t.today.projects} <em>{plural(data.projects.length, t.counts.project)}</em></h3>
              {data.projects.length
                ? <Bars items={data.projects} total={data.activeSeconds} tone="var(--water)" />
                : <p className="empty">{t.today.noProject}</p>}
            </div>
          </div>

          <div className="grid g2">
            <div className="panel">
              <h3>{t.today.windows}</h3>
              <div className="rows">
                {data.windows.slice(0, 8).map((janela, i) => (
                  <div key={i} className="row">
                    <span className="name" title={janela.title}>
                      <span style={{ color: 'var(--text-dim)' }}>{janela.app}</span> · {janela.title}
                    </span>
                    <span className="value">{duration(janela.seconds)}</span>
                  </div>
                ))}
                {!data.windows.length && <p className="empty">{t.today.noTitles}</p>}
              </div>
            </div>
          </div>

          <div className="panel">
            <h3>
              {t.today.hands}
              <em>
                {number(data.input.keys)} {t.today.keys} ·{' '}
                {number(data.input.clicks)} {t.today.clicks} ·{' '}
                {number(data.input.scroll)} {t.today.scroll}
              </em>
            </h3>
            <div className="rows">
              {data.inputPerApp.map((linha) => {
                const total = linha.keys + linha.clicks + linha.scroll
                const writing = total ? linha.keys / total : 0
                return (
                  <div key={linha.app} className="row">
                    <span className="name">{linha.app}</span>
                    <span className="value">
                      {writing > 0.4 ? t.today.writing : writing > 0.12 ? t.today.mixed : t.today.reading}
                    </span>
                    <span className="track"
                      title={`${number(linha.keys)} ${t.today.keys}, ${number(linha.clicks)} ${t.today.clicks}, ${number(linha.scroll)} ${t.today.scroll}`}>
                      <i style={{
                        width: `${Math.round(writing * 100)}%`,
                        background: 'var(--gold)', boxShadow: '0 0 9px var(--gold)', opacity: 0.85,
                      }} />
                    </span>
                  </div>
                )
              })}
              {!data.inputPerApp.length && <p className="empty">{t.today.noKeyboard}</p>}
            </div>
            <div className="note">{t.today.handsNote}</div>
          </div>

          <div className="grid g2">
            <div className="panel">
              <h3>
                {t.today.whatCameOut}
                <em>{plural(data.commits.length, t.counts.commit)} · {plural(data.aiTurns.length, t.counts.aiRequest)}</em>
              </h3>
              <div className="rows" style={{ maxHeight: 250, overflowY: 'auto' }}>
                {data.commits.map((commit, i) => (
                  <div key={i} className="row" style={{ gridTemplateColumns: '1fr auto' }}>
                    <span className="name">
                      <span style={{ color: 'var(--code)' }}>{commit.repo}</span> · {commit.subject}
                    </span>
                    <span className="value">+{commit.insertions}/−{commit.deletions}</span>
                  </div>
                ))}
                {data.aiTurns.slice(-12).map((turno, i) => (
                  <div key={`ia-${i}`} className="row" style={{ gridTemplateColumns: '1fr auto' }}>
                    <span className="name" title={turno.prompt}>
                      <span style={{ color: 'var(--ai)' }}>{turno.project}</span> · {turno.prompt}
                    </span>
                    <span className="value">{clock(turno.ts)}</span>
                  </div>
                ))}
                {!data.commits.length && !data.aiTurns.length && <p className="empty">{t.today.nothingRecorded}</p>}
              </div>
            </div>

            <div className="panel">
              <h3>
                {t.today.signals}
                <em>
                  {plural(data.visits, t.counts.visit)}
                  {data.hosts.length > 0 && ` · ${plural(data.hosts.length, t.counts.site)}`}
                </em>
              </h3>
              <div className="rows">
                {data.hosts.slice(0, 6).map((host) => (
                  <div key={host.name} className="row">
                    <span className="name">{host.name}</span>
                    <span className="value">{number(host.n)}</span>
                  </div>
                ))}
              </div>
              {data.shortcuts.length > 0 && (
                <>
                  <h3 style={{ marginTop: 20 }}>{t.today.shortcuts}</h3>
                  <div className="legend" style={{ marginTop: 0 }}>
                    {data.shortcuts.slice(0, 8).map((atalho) => (
                      <span key={atalho.name} className="pill">
                        {atalho.name} <span style={{ color: 'var(--text-dim)' }}>×{atalho.n}</span>
                      </span>
                    ))}
                  </div>
                </>
              )}
              {data.typing.chars > 0 && (
                <div className="note" style={{ marginTop: 16 }}>
                  {number(data.typing.chars)} {t.today.charactersTypedIn} {number(data.typing.samples)}
                </div>
              )}

              {(data.soundtrack.seconds > 60 || data.soundtrack.inCall > 60) && (
                <>
                  <h3 style={{ marginTop: 22 }}>{t.today.sound}</h3>
                  <div className="rows">
                    {data.soundtrack.seconds > 60 && (
                      <div className="row">
                        <span className="name">{t.today.somethingPlaying}</span>
                        <span className="value">{duration(data.soundtrack.seconds)}</span>
                      </div>
                    )}
                    {data.soundtrack.inCall > 60 && (
                      <div className="row">
                        <span className="name">{t.today.call}</span>
                        <span className="value">{duration(data.soundtrack.inCall)}</span>
                      </div>
                    )}
                  </div>
                </>
              )}

              {data.screens.length > 1 && (
                <>
                  <h3 style={{ marginTop: 22 }}>{t.today.screens}</h3>
                  <div className="rows">
                    {data.screens.map((canvas) => (
                      <div key={canvas.name} className="row">
                        <span className="name">{canvas.name}</span>
                        <span className="value">{duration(canvas.seconds)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
