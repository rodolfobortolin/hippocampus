import { useState } from 'react'
import { colour, duration, weekdayNames, number, shortDate, plural } from '../lib/format.ts'
import { useLanguage } from '../lib/language.tsx'
import type { RibbonBlock, Slice, Slot } from '../lib/api.ts'

/** "12 others" is the app's own aggregate, not a project — translated here. */
function sliceName(name: string, category: (c: string) => string, outros: (n: number) => string): string {
  const aggregate = /^__outros__(\d+)$/.exec(name)
  return aggregate ? outros(Number(aggregate[1])) : category(name)
}

const polar = (cx: number, cy: number, radius: number, degree: number) => {
  const rad = ((degree - 90) * Math.PI) / 180
  return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) }
}

function arc(cx: number, cy: number, outer: number, inner: number, de: number, to: number): string {
  const large = to - de > 180 ? 1 : 0
  const a = polar(cx, cy, outer, to)
  const b = polar(cx, cy, outer, de)
  const c = polar(cx, cy, inner, de)
  const d = polar(cx, cy, inner, to)
  return `M${a.x} ${a.y}A${outer} ${outer} 0 ${large} 0 ${b.x} ${b.y}` +
    `L${c.x} ${c.y}A${inner} ${inner} 0 ${large} 1 ${d.x} ${d.y}Z`
}

/** The category donut. The hole in the middle carries the total. */
export function Donut({ slices, total }: { slices: Slice[]; total: number }) {
  const { t, category } = useLanguage()
  const [hovered, setSobre] = useState<number | null>(null)
  if (!total) return <p className="empty">{t.common.noTime}</p>

  let accumulated = 0
  const shapes = slices.map((slice, index) => {
    const de = (accumulated / total) * 360
    accumulated += slice.seconds
    const to = (accumulated / total) * 360
    // Um respiro entre slices, sem deixar a slice fina sumir.
    const gap = Math.min(1.4, (to - de) / 4)
    return { slice, de: de + gap, to: to - gap, index }
  })

  const highlighted = hovered != null ? slices[hovered] : null

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
      <svg viewBox="0 0 160 160" style={{ width: 160, height: 160, flex: 'none' }}>
        {shapes.map(({ slice, de, to, index }) => (
          <path
            key={slice.name}
            d={arc(80, 80, hovered === index ? 74 : 70, 50, de, to)}
            fill={colour(slice.name)}
            opacity={hovered == null || hovered === index ? 0.92 : 0.28}
            style={{ transition: 'opacity .18s, d .18s', cursor: 'default' }}
            onMouseEnter={() => setSobre(index)}
            onMouseLeave={() => setSobre(null)}
          />
        ))}
        <text x="80" y="76" textAnchor="middle" fill="var(--text)" fontSize="21" fontWeight="300"
          style={{ fontVariantNumeric: 'tabular-nums' }}>
          {duration(highlighted ? highlighted.seconds : total)}
        </text>
        <text x="80" y="94" textAnchor="middle" fill="var(--text-dim)" fontSize="10.5"
          style={{ letterSpacing: '0.07em', textTransform: 'uppercase' }}>
          {highlighted ? category(highlighted.name) : t.common.active}
        </text>
      </svg>

      <div className="rows" style={{ flex: 1, minWidth: 0 }}>
        {slices.slice(0, 7).map((slice, index) => (
          <div key={slice.name} className="row"
            onMouseEnter={() => setSobre(index)} onMouseLeave={() => setSobre(null)}>
            <span className="name" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <i style={{ width: 7, height: 7, borderRadius: 2, background: colour(slice.name), flex: 'none' }} />
              {category(slice.name)}
            </span>
            <span className="value">{Math.round((slice.seconds / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * The day's ribbon: each band is a continuous stretch in the same app.
 *
 * With `only`, one category is picked from the legend under it: its bands stay
 * lit and the rest fade to a trace, so the shape of the day is still there to
 * place them in — hiding the rest would leave bands floating in an empty hour.
 */
export function Ribbon({ blocks, day, dayStart = 4, only = null, onClear }: {
  blocks: RibbonBlock[]; day: string; dayStart?: number
  only?: string | null
  onClear?: () => void
}) {
  const { t, category } = useLanguage()
  const [hovered, setSobre] = useState<RibbonBlock | null>(null)
  const matches = (block: RibbonBlock) =>
    !only || (!block.idle && !block.delegated && (block.category ?? 'unlabelled') === only)
  const picked = only ? blocks.filter(matches) : []
  const pickedSeconds = picked.reduce((sum, block) => sum + (block.end - block.start), 0)
  const [year, month, d] = day.split('-').map(Number)
  const base = new Date(year, month - 1, d, dayStart).getTime() / 1000
  const end = base + 24 * 3600
  const width = 1000
  const position = (ts: number) => ((Math.min(Math.max(ts, base), end) - base) / (24 * 3600)) * width

  const marks = Array.from({ length: 13 }, (_, i) => dayStart + i * 2)

  return (
    <div>
      <div style={{ height: 22, marginBottom: 6, fontSize: 12, color: 'var(--text-mid)' }}>
        {hovered ? (
          <span className="appear">
            <b style={{ color: hovered.delegated ? 'var(--ai)' : 'var(--text)', fontWeight: 500 }}>
              {hovered.delegated ? t.common.agentWorking : hovered.app}
            </b>
            {!hovered.delegated && hovered.title ? ` · ${hovered.title.slice(0, 70)}` : ''}
            <span style={{ color: 'var(--text-dim)' }}> · {duration(hovered.end - hovered.start)}</span>
          </span>
        ) : only ? (
          <span className="ribbon-only appear">
            <i style={{ background: colour(only) }} />
            <b>{category(only)}</b>
            <span>{duration(pickedSeconds)} · {plural(picked.length, t.counts.stretch)}</span>
            {onClear && <button type="button" onClick={onClear}>{t.today.ribbonAll}</button>}
          </span>
        ) : (
          <span style={{ color: 'var(--text-dim)' }}>{t.today.hoverRibbon} · {t.today.ribbonPick}</span>
        )}
      </div>

      {/* The ribbon's SVG is stretched without keeping its ratio, so text inside it
          sai deformado. As hours ficam em HTML, alinhadas por porcentagem. */}
      <svg viewBox={`0 0 ${width} 40`} preserveAspectRatio="none" style={{ width: '100%', height: 40 }}>
        <rect x="0" y="0" width={width} height="36" rx="7" fill="rgba(255,255,255,.035)" />
        {blocks.map((block, index) => {
          const x = position(block.start)
          const w = Math.max(1.4, position(block.end) - x)
          // Delegated time is work happening, just not by your hands: it takes
          // the AI colour and a height of its own, between active and empty.
          const tone = block.delegated ? 'var(--ai)' : block.idle ? 'var(--unlabelled)' : colour(block.category)
          const height = block.delegated ? 22 : block.idle ? 16 : 30
          const top = block.delegated ? 8 : block.idle ? 13 : 3
          // A band that is not the picked category is only a trace, and does
          // not answer the pointer: hovering the gap between two picked bands
          // should not name a window that is not what you asked to see.
          const away = !matches(block)
          return (
            <rect
              key={index} x={x} y={top} width={w} height={height} rx={2}
              fill={tone}
              opacity={away ? 0.07
                : block.delegated ? 0.55 : block.idle ? 0.3 : hovered && hovered !== block ? 0.4 : 0.9}
              style={{ transition: 'opacity .18s', pointerEvents: away ? 'none' : undefined }}
              onMouseEnter={() => setSobre(block)} onMouseLeave={() => setSobre(null)}
            />
          )
        })}
        {marks.map((hour) => {
          const x = ((hour - dayStart) / 24) * width
          return (
            <line key={hour} x1={x} y1="37" x2={x} y2="40"
              stroke="rgba(255,255,255,.14)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          )
        })}
      </svg>

      <div className="ribbon-hours">
        {marks.map((hour) => (
          <span key={hour} style={{ left: `${((hour - dayStart) / 24) * 100}%` }}>
            {String(hour % 24).padStart(2, '0')}{t.common.h}
          </span>
        ))}
      </div>
    </div>
  )
}

/**
 * The focus gauge. The big number is the absolute time, not the ratio: a ratio
 * on its own rewards a short day — one hour of pure code would read 100%.
 */
export function Gauge({ value, seconds }: { value: number; seconds?: number }) {
  const t = useLanguage().t
  const percent = Math.round(value * 100)
  const hours = seconds != null ? duration(seconds) : null
  const radius = 52
  const circumference = Math.PI * radius
  return (
    <svg viewBox="0 0 130 74" style={{ width: '100%', maxWidth: 190 }}>
      <path d={`M13 66A${radius} ${radius} 0 0 1 117 66`} fill="none"
        stroke="rgba(255,255,255,.07)" strokeWidth="9" strokeLinecap="round" />
      <path d={`M13 66A${radius} ${radius} 0 0 1 117 66`} fill="none"
        stroke="var(--gold)" strokeWidth="9" strokeLinecap="round"
        strokeDasharray={`${(percent / 100) * circumference} ${circumference}`}
        style={{ filter: 'drop-shadow(0 0 7px rgba(255,209,102,.5))', transition: 'stroke-dasharray .7s cubic-bezier(.22,1,.36,1)' }} />
      {hours ? (
        <>
          <text x="65" y="56" textAnchor="middle" fill="var(--gold)" fontSize="27" fontWeight="300"
            style={{ fontVariantNumeric: 'tabular-nums' }}>{hours}</text>
          <text x="65" y="70" textAnchor="middle" fill="var(--text-dim)" fontSize="11"
            style={{ fontVariantNumeric: 'tabular-nums' }}>{percent}% {t.common.ofActive}</text>
        </>
      ) : (
        <text x="65" y="60" textAnchor="middle" fill="var(--gold)" fontSize="30" fontWeight="300"
          style={{ fontVariantNumeric: 'tabular-nums' }}>{percent}<tspan fontSize="15">%</tspan></text>
      )}
    </svg>
  )
}

/**
 * Heatmap hour × day da semana. Quanto mais quente, mais tempo ali.
 *
 * The labels live in HTML, outside the SVG. Text inside an SVG scales with
 * o desenho — num monitor largo a mesma source chegava ao dobro do size do
 * rest of the interface, and shrinking the font inside the SVG only defers the
 * problem, because
 * the scale factor changes with the width of the window.
 */
/**
 * Hour × weekday, summed over the period.
 *
 * With `onPick`, it is also the filter for what sits below it: a cell narrows
 * to that weekday at that hour, a weekday's name to the whole day, and the same
 * pick again lets go. The map itself never narrows — it is what you choose
 * from, so it has to keep every cell on it.
 */
export function Heatmap({ grid, slot, onPick }: {
  grid: number[][]
  slot?: Slot
  onPick?: (slot: Slot) => void
}) {
  const t = useLanguage().t
  const WEEKDAYS = weekdayNames()
  const [hovered, setHovered] = useState<{ day: number; hour: number } | null>(null)
  const largest = Math.max(1, ...grid.flat())
  const cell = 30
  const gap = 5
  const width = 24 * (cell + gap) - gap
  const height = 7 * (cell + gap) - gap

  const weekday = slot?.weekday ?? null
  const hour = slot?.hour ?? null
  const picking = weekday != null
  const chosen = (day: number, h: number) => weekday === day && (hour == null || hour === h)

  const pickCell = (day: number, h: number) => {
    if (!onPick || !grid[day][h]) return
    onPick(weekday === day && hour === h ? {} : { weekday: day, hour: h })
  }
  const pickDay = (day: number) => {
    if (!onPick) return
    onPick(weekday === day && hour == null ? {} : { weekday: day, hour: null })
  }

  const hh = (h: number) => `${String(h).padStart(2, '0')}${t.common.h}`
  const rowTotal = (day: number) => grid[day].reduce((sum, seconds) => sum + seconds, 0)

  return (
    <div>
      <div style={{ minHeight: 18, marginBottom: 10, fontSize: 12, color: 'var(--text-mid)' }}>
        {hovered ? (
          <span className="appear">
            {WEEKDAYS[hovered.day]} {t.common.at} {hh(hovered.hour)} ·{' '}
            <b style={{ fontWeight: 500 }}>{duration(grid[hovered.day][hovered.hour])}</b> {t.common.inTotal}
          </span>
        ) : picking ? (
          <span className="appear">
            {WEEKDAYS[weekday]} {hour != null ? `${t.common.at} ${hh(hour)}` : `· ${t.rhythm.wholeDay}`} ·{' '}
            <b style={{ fontWeight: 500 }}>
              {duration(hour != null ? grid[weekday][hour] : rowTotal(weekday))}
            </b> {t.common.inTotal}
          </span>
        ) : (
          <span style={{ color: 'var(--text-dim)' }}>
            {t.rhythm.sumOfPeriod}
            {onPick && <span className="heatmap-hint"> — {t.rhythm.filterHint}</span>}
          </span>
        )}
      </div>

      {/* Four cells, not two columns: the weekday names share a row with the
          squares only, and the hour ruler sits in a row of its own. Put the
          names in a column that also spans the ruler and each name gets a
          slice of the ruler's height too — the drift grows row by row until
          "Sat" sits most of a row below Saturday. */}
      <div className="heatmap">
        <div className="heatmap-days">
          {WEEKDAYS.map((name, day) => onPick ? (
            <button key={name} type="button"
              className={weekday === day && hour == null ? 'active' : ''}
              onClick={() => pickDay(day)}
              aria-pressed={weekday === day && hour == null}>
              {name}
            </button>
          ) : <span key={name}>{name}</span>)}
        </div>

        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', display: 'block' }}>
          {grid.map((row, day) =>
            row.map((seconds, h) => {
              const intensity = seconds / largest
              const lit = seconds ? 0.13 + intensity * 0.87 : 0.045
              const selected = chosen(day, h)
              // With something picked, the rest steps back so the choice reads
              // at a glance; nothing is hidden, only quieter.
              const opacity = picking && !selected ? lit * 0.4 : lit
              const clickable = Boolean(onPick && seconds)
              return (
                <rect
                  key={`${day}-${h}`}
                  x={h * (cell + gap)} y={day * (cell + gap)}
                  width={cell} height={cell} rx={6}
                  fill="var(--ember)"
                  opacity={opacity}
                  stroke={selected && seconds ? 'var(--gold)' : 'none'}
                  strokeWidth={selected && seconds ? 2 : 0}
                  style={{
                    filter: intensity > 0.62 && (!picking || selected)
                      ? 'drop-shadow(0 0 6px rgba(255,138,61,.5))' : undefined,
                    transition: 'opacity .15s',
                    cursor: clickable ? 'pointer' : 'default',
                  }}
                  onMouseEnter={() => setHovered({ day, hour: h })}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => pickCell(day, h)}
                >
                  <title>{`${WEEKDAYS[day]} ${hh(h)} · ${duration(seconds)}`}</title>
                </rect>
              )
            }),
          )}
        </svg>

        <span aria-hidden="true" />
        <div className="heatmap-hours">
          {[0, 6, 12, 18, 23].map((h) => (
            <span key={h} style={{ left: `${((h + 0.5) / 24) * 100}%` }}>{h}{t.common.h}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * One reading per day, over the period — and which reading it is comes from
 * outside: active time, work delegated to agents, app switches, commits.
 *
 * A chart that only ever drew one number could not answer the question people
 * actually have ("is this going up?"), so the value and the way it is written
 * are given in.
 */
export function Trend({ days, value, format, floor = 3600 }: {
  days: { day: string }[]
  value: (day: any) => number
  format: (n: number) => string
  /** The smallest top of the scale, so a quiet week is not drawn as a mountain. */
  floor?: number
}) {
  const t = useLanguage().t
  const [hovered, setSobre] = useState<number | null>(null)
  if (days.length < 3) return <p className="empty">{t.rhythm.needsThreeDays}</p>

  const width = 1000
  const height = 130
  const largest = Math.max(...days.map(value), floor)
  const x = (i: number) => (i / (days.length - 1)) * width
  const y = (v: number) => height - (v / largest) * (height - 14) - 4

  const points = days.map((d, i) => `${x(i)},${y(value(d))}`).join(' ')
  const mean = days.reduce((sum, d) => sum + value(d), 0) / days.length

  // The tip sits over the point, so a number never has to be read by tracing a
  // line back to an axis. At the ends it leans inward instead of hanging off
  // the panel.
  const side = hovered == null ? '' : hovered <= 1 ? 'start' : hovered >= days.length - 2 ? 'end' : ''

  return (
    <div className="trend">
      <div style={{ height: 18, marginBottom: 6, fontSize: 12, color: 'var(--text-dim)' }}>
        {t.common.averageOf} {format(mean)} {t.common.perDay}
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ width: '100%', height: height }}>
        <defs>
          <linearGradient id="preenche" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--ember)" stopOpacity="0.34" />
            <stop offset="100%" stopColor="var(--ember)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1="0" y1={y(mean)} x2={width} y2={y(mean)}
          stroke="rgba(255,255,255,.16)" strokeWidth="1" strokeDasharray="4 5" />
        <polygon points={`0,${height} ${points} ${width},${height}`} fill="url(#preenche)" />
        <polyline points={points} fill="none" stroke="var(--ember)" strokeWidth="2"
          strokeLinejoin="round" strokeLinecap="round"
          style={{ filter: 'drop-shadow(0 0 6px rgba(255,138,61,.45))' }} vectorEffect="non-scaling-stroke" />
        {days.map((day, i) => (
          <rect key={day.day} x={x(i) - width / days.length / 2} y="0"
            width={width / days.length} height={height} fill="transparent"
            onMouseEnter={() => setSobre(i)} onMouseLeave={() => setSobre(null)} />
        ))}
        {hovered != null && (
          <>
            <line x1={x(hovered)} y1={y(value(days[hovered]))} x2={x(hovered)} y2={height}
              stroke="rgba(255,209,102,.28)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            <circle cx={x(hovered)} cy={y(value(days[hovered]))} r="3.5" fill="var(--gold)"
              style={{ filter: 'drop-shadow(0 0 6px var(--gold))' }} />
          </>
        )}
      </svg>
      {hovered != null && (
        <div className={`trend-tip ${side}`} style={{
          left: `${(x(hovered) / width) * 100}%`,
          top: `${(y(value(days[hovered])) / height) * 100}%`,
        }}>
          <b>{format(value(days[hovered]))}</b>
          <span>{shortDate(days[hovered].day)}</span>
        </div>
      )}
    </div>
  )
}

/** A list with a proportional bar — apps, projects, windows. */
export function Bars({ items, total, tone }: { items: Slice[]; total: number; tone?: string }) {
  const { t, category } = useLanguage()
  if (!items.length) return <p className="empty">{t.common.nothingHere}</p>
  const largest = Math.max(...items.map((i) => i.seconds), 1)
  return (
    <div className="rows">
      {items.map((item) => (
        <div key={item.name} className="row">
          <span className="name">{sliceName(item.name, category, t.common.others)}</span>
          <span className="value">{duration(item.seconds)}</span>
          <span className="track">
            <i style={{
              width: `${(item.seconds / largest) * 100}%`,
              background: tone ?? colour(item.name),
              boxShadow: `0 0 9px ${tone ?? colour(item.name)}`,
              opacity: 0.85,
            }} />
          </span>
        </div>
      ))}
    </div>
  )
}

/**
 * The shape of the focus: how many minutes came from sessions of each length.
 * The bar counts MINUTES, not sessions — counting sessions lets the short
 * pieces dominate the view, and what matters is where the time actually went.
 */
export function FocusShape({ bands, median, largest }: {
  bands: { name: string; minutes: number; n: number }[]
  median: number
  largest: number
}) {
  const t = useLanguage().t
  const [hovered, setSobre] = useState<number | null>(null)
  const total = bands.reduce((sum, f) => sum + f.minutes, 0)
  if (!total) {
    return <p className="empty">{t.today.noSession}</p>
  }

  const largestBand = Math.max(...bands.map((f) => f.minutes), 1)
  const width = 520
  const height = 132
  const step = width / bands.length

  return (
    <div>
      <div style={{ height: 18, marginBottom: 8, fontSize: 12, color: 'var(--text-mid)' }}>
        {hovered != null ? (
          <span className="appear">
            {bands[hovered].n} {bands[hovered].n === 1 ? t.common.session : t.common.sessions} {t.common.of}{' '}
            {bands[hovered].name} {t.common.min} ·{' '}
            <b style={{ fontWeight: 500 }}>{duration(bands[hovered].minutes * 60)}</b> {t.common.inTotal}
          </span>
        ) : (
          <span style={{ color: 'var(--text-dim)' }}>
            {t.today.medianOf} {median}{t.common.min} · {t.today.longestWas} {duration(largest * 60)}
          </span>
        )}
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', maxWidth: 620, height: height }}>
        {bands.map((faixa, index) => {
          const h = (faixa.minutes / largestBand) * (height - 34)
          const x = index * step + step * 0.16
          const w = step * 0.68
          // The glow marks hierarchy, not decoration: only the long session lights up.
          const long = index >= 3
          return (
            <g key={faixa.name}
              onMouseEnter={() => setSobre(index)} onMouseLeave={() => setSobre(null)}>
              <rect x={x} y={0} width={w} height={height - 20} fill="transparent" />
              <rect
                x={x} y={height - 20 - h} width={w} height={Math.max(h, faixa.minutes ? 2 : 0)} rx={3}
                fill={long ? 'var(--gold)' : 'var(--ember)'}
                opacity={hovered == null || hovered === index ? 0.9 : 0.4}
                style={{
                  filter: long && faixa.minutes ? 'drop-shadow(0 0 8px rgba(255,209,102,.5))' : undefined,
                  transition: 'opacity .16s',
                }}
              />
              {faixa.minutes > 0 && (
                <text x={x + w / 2} y={height - 26 - h} textAnchor="middle"
                  fill="var(--text-mid)" fontSize="11" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {number(faixa.minutes)}
                </text>
              )}
              <text x={x + w / 2} y={height - 4} textAnchor="middle" fill="var(--text-dim)" fontSize="11">
                {faixa.name}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
