import { useEffect, useState } from 'react'
import { api, type Period, type PeriodSummary, type Slot } from '../lib/api.ts'
import { duration, hours, addDays, today as todayString, number, topSlices, plural, weekdayNames } from '../lib/format.ts'
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
  const [slot, setSlot] = useState<Slot>({})
  const [data, setData] = useState<Period | null>(null)

  // The previous answer stays on screen until the next one lands, so picking a
  // cell changes the charts below without the whole page blinking out.
  useEffect(() => {
    let alive = true
    const to = todayString()
    api.period(addDays(to, -(span - 1)), to, slot).then((d) => alive && setData(d))
    return () => { alive = false }
  }, [span, slot.weekday, slot.hour])

  if (!data) return <p className="empty">{t.today.loading}</p>

  const { summary } = data
  // The charts under the map show the pick; the figures at the top never do.
  const below = data.narrowed ?? summary
  const picked = slot.weekday != null
  const WEEKDAYS = weekdayNames()
  const pickedLabel = picked
    ? `${WEEKDAYS[slot.weekday!]} ${slot.hour != null
      ? `${t.common.at} ${String(slot.hour).padStart(2, '0')}${t.common.h}`
      : `· ${t.rhythm.wholeDay}`}`
    : ''
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

          {measured.length >= 3 && (
            <div className="panel">
              <h3>{t.rhythm.trend} <em>{t.rhythm.activeTimePerDay}</em></h3>
              <Trend days={data.days} />
            </div>
          )}

          <div className="panel">
            <h3>{t.rhythm.whenYouWork} <em>{t.rhythm.hourByWeekday}</em></h3>
            <Heatmap grid={data.rhythm} slot={slot} onPick={setSlot} />
          </div>

          {picked && (
            <div className="slot-chip appear">
              <span>{t.rhythm.showingOnly} <b>{pickedLabel}</b></span>
              <button type="button" onClick={() => setSlot({})}>{t.rhythm.clearFilter}</button>
            </div>
          )}

          {picked && !below.total ? (
            <div className="panel" style={{ padding: '28px 20px', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-mid)' }}>{t.rhythm.nothingThen}</p>
            </div>
          ) : <>
          <div className="grid g32">
            <div className="panel">
              <h3>{t.rhythm.whereTimeWent}</h3>
              <Bars items={topSlices(below.apps)} total={below.total} tone="var(--ember)" />
            </div>
            <div className="panel">
              <h3>{t.rhythm.byCategory}</h3>
              <Donut slices={below.categories} total={below.total} />
            </div>
          </div>

          <div className="grid g2">
            <div className="panel">
              <h3>{t.rhythm.projects}</h3>
              {below.projects.length
                ? <Bars items={below.projects} total={below.total} tone="var(--water)" />
                : <p className="empty">{t.rhythm.noProject}</p>}
            </div>

            <div className="panel">
              <h3>{t.rhythm.signature}</h3>
              {below.shortcuts.length ? (
                <div className="legend" style={{ marginTop: 0 }}>
                  {below.shortcuts.map((shortcut) => (
                    <span key={shortcut.name} className="pill" style={{ fontSize: 12.5, padding: '5px 11px' }}>
                      <b style={{ fontWeight: 500 }}>{shortcut.name}</b>
                      <span style={{ color: 'var(--text-dim)' }}>×{shortcut.n}</span>
                    </span>
                  ))}
                </div>
              ) : <p className="empty">{t.rhythm.noShortcuts}</p>}

              <h3 style={{ marginTop: 22 }}>{t.rhythm.sites}</h3>
              <div className="rows">
                {below.hosts.slice(0, 7).map((host) => (
                  <div key={host.name} className="row">
                    <span className="name">{host.name}</span>
                    <span className="value">{number(host.n)}</span>
                  </div>
                ))}
              </div>

              {below.typing.chars > 0 && (
                <div className="note" style={{ marginTop: 16 }}>
                  {number(below.typing.chars)} {t.rhythm.characters}
                </div>
              )}
            </div>
          </div>

          <div className="grid g2">
            <Hands summary={below} />
            <div className="panel">
              <h3>{t.rhythm.written}</h3>
              <p className="note" style={{ marginTop: -6, marginBottom: 14 }}>{t.rhythm.writtenNote}</p>
              {below.written.length ? (
                <div className="rows">
                  {below.written.map((row) => (
                    <div key={row.kind} className="row">
                      <span className="name">{t.rhythm.writing[row.kind]}</span>
                      <span className="value">{number(row.chars)}</span>
                      <span className="track"><i style={{
                        width: `${(row.chars / below.written[0].chars) * 100}%`,
                        background: 'var(--writing)', boxShadow: '0 0 9px var(--writing)', opacity: 0.8,
                      }} /></span>
                    </div>
                  ))}
                </div>
              ) : <p className="empty">{t.common.nothingHere}</p>}
            </div>
          </div>
          </>}
        </div>
      )}
    </>
  )
}

/**
 * Where the keys went, per app — counted in every block, no text kept. The
 * lead line is a record, not a verdict: "most of the keys went to Claude".
 */
function Hands({ summary }: { summary: PeriodSummary }) {
  const t = useLanguage().t
  const keys = summary.hands.reduce((sum, app) => sum + app.keys, 0)
  const top = summary.hands[0]
  return (
    <div className="panel">
      <h3>{t.today.hands}</h3>
      {keys > 0 && top ? (
        <>
          <p className="note" style={{ marginTop: -6, marginBottom: 14 }}>
            {t.rhythm.handsLead(Math.round((top.keys / keys) * 100), top.name)}
          </p>
          <div className="rows">
            {summary.hands.filter((app) => app.keys > 0).map((app) => (
              <div key={app.name} className="row">
                <span className="name">{app.name}</span>
                <span className="value">{number(app.keys)} {t.today.keys}</span>
                <span className="track"><i style={{
                  width: `${(app.keys / top.keys) * 100}%`,
                  background: 'var(--ember)', boxShadow: '0 0 9px var(--ember)', opacity: 0.8,
                }} /></span>
              </div>
            ))}
          </div>
        </>
      ) : <p className="empty">{t.rhythm.noHands}</p>}
    </div>
  )
}
