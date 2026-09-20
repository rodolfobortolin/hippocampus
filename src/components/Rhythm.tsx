import { useEffect, useState } from 'react'
import { api, type Period } from '../lib/api.ts'
import { duration, hours, addDays, today as diaDeHoje, number, topSlices, plural } from '../lib/format.ts'
import { useLanguage } from '../lib/language.tsx'
import { Heatmap, Trend, Bars, Donut } from './charts.tsx'

export function Rhythm() {
  const t = useLanguage().t
  const WINDOWS = [
    { days: 7, name: t.rhythm.days7 },
    { days: 30, name: t.rhythm.days30 },
    { days: 90, name: t.rhythm.days90 },
  ]
  const [span, setSpan] = useState(30)
  const [data, setData] = useState<Period | null>(null)

  useEffect(() => {
    let alive = true
    const to = diaDeHoje()
    api.period(addDays(to, -(span - 1)), to).then((d) => alive && setData(d))
    return () => { alive = false }
  }, [span])

  if (!data) return <p className="empty">{t.today.loading}</p>

  const { summary } = data
  const measured = data.days.filter((d) => d.active > 60)
  const mean = measured.length ? summary.total / measured.length : 0
  const total = hours(summary.total)
  const longest = [...measured].sort((a, b) => b.active - a.active)[0]

  return (
    <>
      <div className="top">
        <div>
          <h2><b>{t.rhythm.title}</b></h2>
          <p>{plural(measured.length, t.counts.day)} {t.rhythm.between} {data.from} {t.rhythm.and} {data.to}</p>
        </div>
        <div className="nav">
          {WINDOWS.map((option) => (
            <button key={option.days} onClick={() => setSpan(option.days)}
              className={span === option.days ? 'active' : ''}>{option.name}</button>
          ))}
        </div>
      </div>

      {!measured.length ? (
        <div className="panel" style={{ padding: '40px 20px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-mid)' }}>{t.rhythm.noDays}</p>
          <p className="note">{t.rhythm.rhythmAppears}</p>
        </div>
      ) : (
        <div className="grid" style={{ gap: 14 }}>
          <div className="grid g4">
            <div className="panel">
              <div className="label">{t.rhythm.totalTime}</div>
              <div className="number glow">{total.value}<small>{total.unit}</small></div>
              <div className="note">{t.common.averageOf} {duration(mean)} {t.rhythm.perDay}</div>
            </div>
            <div className="panel">
              <div className="label">{t.rhythm.averageFocus}</div>
              <div className="number ember">{Math.round(summary.focusRatio * 100)}<small>%</small></div>
              <div className="note">{t.rhythm.averageFocusNote}</div>
            </div>
            <div className="panel">
              <div className="label">{t.rhythm.longestDay}</div>
              <div className="number" style={{ fontSize: 30 }}>{duration(longest?.active ?? 0)}</div>
              <div className="note">{longest?.day}</div>
            </div>
            <div className="panel">
              <div className="label">{t.rhythm.output}</div>
              <div className="number" style={{ fontSize: 30 }}>{number(summary.commits)}<small> {t.rhythm.commits}</small></div>
              <div className="note">
                {summary.agents.length
                  ? summary.agents.map((a) => `${duration(a.minutes * 60)} ${t.common.of} ${a.name}`).join(' · ')
                  : plural(summary.aiTurns, t.counts.aiRequest)}
              </div>
            </div>
          </div>

          <div className="panel">
            <h3>{t.rhythm.whenYouWork} <em>{t.rhythm.hourByWeekday}</em></h3>
            <Heatmap grid={data.rhythm} />
          </div>

          {measured.length >= 3 && (
            <div className="panel">
              <h3>{t.rhythm.trend} <em>{t.rhythm.activeTimePerDay}</em></h3>
              <Trend days={data.days} />
            </div>
          )}

          <div className="grid g32">
            <div className="panel">
              <h3>{t.rhythm.whereTimeWent}</h3>
              <Bars items={topSlices(summary.apps)} total={summary.total} tone="var(--ember)" />
            </div>
            <div className="panel">
              <h3>{t.rhythm.byCategory}</h3>
              <Donut slices={summary.categories} total={summary.total} />
            </div>
          </div>

          <div className="grid g2">
            <div className="panel">
              <h3>{t.rhythm.projects}</h3>
              {summary.projects.length
                ? <Bars items={summary.projects} total={summary.total} tone="var(--water)" />
                : <p className="empty">{t.rhythm.noProject}</p>}
            </div>

            <div className="panel">
              <h3>{t.rhythm.signature}</h3>
              {summary.shortcuts.length ? (
                <div className="legend" style={{ marginTop: 0 }}>
                  {summary.shortcuts.map((atalho) => (
                    <span key={atalho.name} className="pill" style={{ fontSize: 12.5, padding: '5px 11px' }}>
                      <b style={{ fontWeight: 500 }}>{atalho.name}</b>
                      <span style={{ color: 'var(--text-dim)' }}>×{atalho.n}</span>
                    </span>
                  ))}
                </div>
              ) : <p className="empty">{t.rhythm.noShortcuts}</p>}

              <h3 style={{ marginTop: 22 }}>{t.rhythm.sites}</h3>
              <div className="rows">
                {summary.hosts.slice(0, 7).map((host) => (
                  <div key={host.name} className="row">
                    <span className="name">{host.name}</span>
                    <span className="value">{number(host.n)}</span>
                  </div>
                ))}
              </div>

              {summary.typing.chars > 0 && (
                <div className="note" style={{ marginTop: 16 }}>
                  {number(summary.typing.chars)} {t.rhythm.characters}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
