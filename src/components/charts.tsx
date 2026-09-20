import { useState } from 'react'
import { colour, duration, weekdayNames, number } from '../lib/format.ts'
import { useLanguage } from '../lib/language.tsx'
import type { RibbonBlock, Slice } from '../lib/api.ts'

/** "outros 12" é um aggregate do próprio app, não um projeto — traduz aqui. */
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

/** Donut das categorias. O buraco do meio load o total. */
export function Donut({ slices, total }: { slices: Slice[]; total: number }) {
  const { t, category } = useLanguage()
  const [hovered, setSobre] = useState<number | null>(null)
  if (!total) return <p className="vazio">{t.common.noTime}</p>

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
        <text x="80" y="94" textAnchor="middle" fill="var(--text-fraco)" fontSize="10.5"
          style={{ letterSpacing: '0.07em', textTransform: 'uppercase' }}>
          {highlighted ? category(highlighted.name) : t.common.active}
        </text>
      </svg>

      <div className="linhas" style={{ flex: 1, minWidth: 0 }}>
        {slices.slice(0, 7).map((slice, index) => (
          <div key={slice.name} className="linha"
            onMouseEnter={() => setSobre(index)} onMouseLeave={() => setSobre(null)}>
            <span className="nome" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <i style={{ width: 7, height: 7, borderRadius: 2, background: colour(slice.name), flex: 'none' }} />
              {category(slice.name)}
            </span>
            <span className="valor">{Math.round((slice.seconds / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** A fita do day: cada faixa é um pedaço contínuo no mesmo app. */
export function Ribbon({ blocks, day, dayStart = 4 }: { blocks: RibbonBlock[]; day: string; dayStart?: number }) {
  const t = useLanguage().t
  const [hovered, setSobre] = useState<RibbonBlock | null>(null)
  const [year, month, d] = day.split('-').map(Number)
  const base = new Date(year, month - 1, d, dayStart).getTime() / 1000
  const end = base + 24 * 3600
  const width = 1000
  const position = (ts: number) => ((Math.min(Math.max(ts, base), end) - base) / (24 * 3600)) * width

  const marks = Array.from({ length: 13 }, (_, i) => dayStart + i * 2)

  return (
    <div>
      <div style={{ height: 22, marginBottom: 6, fontSize: 12, color: 'var(--text-medio)' }}>
        {hovered ? (
          <span className="aparece">
            <b style={{ color: hovered.delegated ? 'var(--ia)' : 'var(--text)', fontWeight: 500 }}>
              {hovered.delegated ? t.common.agentWorking : hovered.app}
            </b>
            {!hovered.delegated && hovered.title ? ` · ${hovered.title.slice(0, 70)}` : ''}
            <span style={{ color: 'var(--text-fraco)' }}> · {duration(hovered.end - hovered.start)}</span>
          </span>
        ) : (
          <span style={{ color: 'var(--text-fraco)' }}>{t.today.hoverRibbon}</span>
        )}
      </div>

      {/* O SVG da fita é esticado sem manter proporção, então text dentro dele
          sai deformado. As hours ficam em HTML, alinhadas por porcentagem. */}
      <svg viewBox={`0 0 ${width} 40`} preserveAspectRatio="none" style={{ width: '100%', height: 40 }}>
        <rect x="0" y="0" width={width} height="36" rx="7" fill="rgba(255,255,255,.035)" />
        {blocks.map((block, index) => {
          const x = position(block.start)
          const w = Math.max(1.4, position(block.end) - x)
          // Tempo delegado é trabalho acontecendo, só que não pelas suas mãos:
          // ganha a colour da IA e height própria, entre o active e o vazio.
          const tone = block.delegated ? 'var(--ia)' : block.idle ? 'var(--sem-rotulo)' : colour(block.category)
          const height = block.delegated ? 22 : block.idle ? 16 : 30
          const top = block.delegated ? 8 : block.idle ? 13 : 3
          return (
            <rect
              key={index} x={x} y={top} width={w} height={height} rx={2}
              fill={tone}
              opacity={block.delegated ? 0.55 : block.idle ? 0.3 : hovered && hovered !== block ? 0.4 : 0.9}
              style={{ transition: 'opacity .18s' }}
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

      <div className="fita-hours">
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
 * Gauge de foco. O número large é a hour absoluta, e não a proporção:
 * proporção sozinha premia o day curto — 1h de código puro daria 100%.
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
        stroke="var(--ouro)" strokeWidth="9" strokeLinecap="round"
        strokeDasharray={`${(percent / 100) * circumference} ${circumference}`}
        style={{ filter: 'drop-shadow(0 0 7px rgba(255,209,102,.5))', transition: 'stroke-dasharray .7s cubic-bezier(.22,1,.36,1)' }} />
      {hours ? (
        <>
          <text x="65" y="56" textAnchor="middle" fill="var(--ouro)" fontSize="27" fontWeight="300"
            style={{ fontVariantNumeric: 'tabular-nums' }}>{hours}</text>
          <text x="65" y="70" textAnchor="middle" fill="var(--text-fraco)" fontSize="11"
            style={{ fontVariantNumeric: 'tabular-nums' }}>{percent}% {t.common.ofActive}</text>
        </>
      ) : (
        <text x="65" y="60" textAnchor="middle" fill="var(--ouro)" fontSize="30" fontWeight="300"
          style={{ fontVariantNumeric: 'tabular-nums' }}>{percent}<tspan fontSize="15">%</tspan></text>
      )}
    </svg>
  )
}

/**
 * Heatmap hour × day da semana. Quanto mais quente, mais tempo ali.
 *
 * Os rótulos ficam em HTML, fora do SVG. Texto dentro do SVG scale junto com
 * o desenho — num monitor largo a mesma source chegava ao dobro do size do
 * rest da interface, e diminuir a source no SVG só empurra o problema, porque
 * o fator de scale muda com a width da janela.
 */
export function Heatmap({ grid }: { grid: number[][] }) {
  const t = useLanguage().t
  const WEEKDAYS = weekdayNames()
  const [hovered, setSobre] = useState<{ day: number; hour: number } | null>(null)
  const largest = Math.max(1, ...grid.flat())
  const cell = 30
  const gap = 5
  const width = 24 * (cell + gap) - gap
  const height = 7 * (cell + gap) - gap

  return (
    <div>
      <div style={{ height: 18, marginBottom: 10, fontSize: 12, color: 'var(--text-medio)' }}>
        {hovered ? (
          <span className="aparece">
            {WEEKDAYS[hovered.day]} {t.common.at} {String(hovered.hour).padStart(2, '0')}{t.common.h} ·{' '}
            <b style={{ fontWeight: 500 }}>{duration(grid[hovered.day][hovered.hour])}</b> {t.common.inTotal}
          </span>
        ) : <span style={{ color: 'var(--text-fraco)' }}>{t.rhythm.sumOfPeriod}</span>}
      </div>

      <div className="mapa">
        <div className="mapa-days">
          {WEEKDAYS.map((name) => <span key={name}>{name}</span>)}
        </div>

        <div>
          <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', display: 'block' }}>
            {grid.map((linha, day) =>
              linha.map((seconds, hour) => {
                const intensity = seconds / largest
                return (
                  <rect
                    key={`${day}-${hour}`}
                    x={hour * (cell + gap)} y={day * (cell + gap)}
                    width={cell} height={cell} rx={6}
                    fill="var(--brasa)"
                    opacity={seconds ? 0.13 + intensity * 0.87 : 0.045}
                    style={{
                      filter: intensity > 0.62 ? 'drop-shadow(0 0 6px rgba(255,138,61,.5))' : undefined,
                      transition: 'opacity .15s',
                    }}
                    onMouseEnter={() => setSobre({ day, hour })} onMouseLeave={() => setSobre(null)}
                  />
                )
              }),
            )}
          </svg>

          <div className="mapa-hours">
            {[0, 6, 12, 18, 23].map((hour) => (
              <span key={hour}
                style={{ left: `${((hour + 0.5) / 24) * 100}%` }}>{hour}{t.common.h}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/** Tendência do tempo active por day. */
export function Trend({ days }: { days: { day: string; active: number }[] }) {
  const t = useLanguage().t
  const [hovered, setSobre] = useState<number | null>(null)
  if (days.length < 3) return <p className="vazio">{t.rhythm.needsThreeDays}</p>

  const width = 1000
  const height = 130
  const largest = Math.max(...days.map((d) => d.active), 3600)
  const x = (i: number) => (i / (days.length - 1)) * width
  const y = (v: number) => height - (v / largest) * (height - 14) - 4

  const points = days.map((d, i) => `${x(i)},${y(d.active)}`).join(' ')
  const mean = days.reduce((sum, d) => sum + d.active, 0) / days.length

  return (
    <div>
      <div style={{ height: 18, marginBottom: 6, fontSize: 12, color: 'var(--text-medio)' }}>
        {hovered != null ? (
          <span className="aparece">
            {days[hovered].day} · <b style={{ fontWeight: 500 }}>{duration(days[hovered].active)}</b>
          </span>
        ) : (
          <span style={{ color: 'var(--text-fraco)' }}>{t.common.averageOf} {duration(mean)} {t.common.perDay}</span>
        )}
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ width: '100%', height: height }}>
        <defs>
          <linearGradient id="preenche" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--brasa)" stopOpacity="0.34" />
            <stop offset="100%" stopColor="var(--brasa)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1="0" y1={y(mean)} x2={width} y2={y(mean)}
          stroke="rgba(255,255,255,.16)" strokeWidth="1" strokeDasharray="4 5" />
        <polygon points={`0,${height} ${points} ${width},${height}`} fill="url(#preenche)" />
        <polyline points={points} fill="none" stroke="var(--brasa)" strokeWidth="2"
          strokeLinejoin="round" strokeLinecap="round"
          style={{ filter: 'drop-shadow(0 0 6px rgba(255,138,61,.45))' }} vectorEffect="non-scaling-stroke" />
        {days.map((day, i) => (
          <rect key={day.day} x={x(i) - width / days.length / 2} y="0"
            width={width / days.length} height={height} fill="transparent"
            onMouseEnter={() => setSobre(i)} onMouseLeave={() => setSobre(null)} />
        ))}
        {hovered != null && (
          <circle cx={x(hovered)} cy={y(days[hovered].active)} r="3.5" fill="var(--ouro)"
            style={{ filter: 'drop-shadow(0 0 6px var(--ouro))' }} />
        )}
      </svg>
    </div>
  )
}

/** Lista com barra proporcional — apps, projetos, janelas. */
export function Bars({ items, total, tone }: { items: Slice[]; total: number; tone?: string }) {
  const { t, category } = useLanguage()
  if (!items.length) return <p className="vazio">{t.common.nothingHere}</p>
  const largest = Math.max(...items.map((i) => i.seconds), 1)
  return (
    <div className="linhas">
      {items.map((item) => (
        <div key={item.name} className="linha">
          <span className="nome">{sliceName(item.name, category, t.common.others)}</span>
          <span className="valor">{duration(item.seconds)}</span>
          <span className="trilho">
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
 * A focusShape do foco: quantos minutes vieram de sessões de cada size.
 * A barra conta MINUTOS, não sessões — contar sessões faz os pedaços curtos
 * dominarem a vista, e o que interessa é where o tempo foi de fato.
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
    return <p className="vazio">{t.today.noSession}</p>
  }

  const largestBand = Math.max(...bands.map((f) => f.minutes), 1)
  const width = 520
  const height = 132
  const step = width / bands.length

  return (
    <div>
      <div style={{ height: 18, marginBottom: 8, fontSize: 12, color: 'var(--text-medio)' }}>
        {hovered != null ? (
          <span className="aparece">
            {bands[hovered].n} {bands[hovered].n === 1 ? t.common.session : t.common.sessions} {t.common.of}{' '}
            {bands[hovered].name} {t.common.min} ·{' '}
            <b style={{ fontWeight: 500 }}>{duration(bands[hovered].minutes * 60)}</b> {t.common.inTotal}
          </span>
        ) : (
          <span style={{ color: 'var(--text-fraco)' }}>
            {t.today.medianOf} {median}{t.common.min} · {t.today.longestWas} {duration(largest * 60)}
          </span>
        )}
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', maxWidth: 620, height: height }}>
        {bands.map((faixa, index) => {
          const h = (faixa.minutes / largestBand) * (height - 34)
          const x = index * step + step * 0.16
          const w = step * 0.68
          // O glow marca hierarquia, não enfeite: só a sessão long acende.
          const long = index >= 3
          return (
            <g key={faixa.name}
              onMouseEnter={() => setSobre(index)} onMouseLeave={() => setSobre(null)}>
              <rect x={x} y={0} width={w} height={height - 20} fill="transparent" />
              <rect
                x={x} y={height - 20 - h} width={w} height={Math.max(h, faixa.minutes ? 2 : 0)} rx={3}
                fill={long ? 'var(--ouro)' : 'var(--brasa)'}
                opacity={hovered == null || hovered === index ? 0.9 : 0.4}
                style={{
                  filter: long && faixa.minutes ? 'drop-shadow(0 0 8px rgba(255,209,102,.5))' : undefined,
                  transition: 'opacity .16s',
                }}
              />
              {faixa.minutes > 0 && (
                <text x={x + w / 2} y={height - 26 - h} textAnchor="middle"
                  fill="var(--text-medio)" fontSize="11" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {number(faixa.minutes)}
                </text>
              )}
              <text x={x + w / 2} y={height - 4} textAnchor="middle" fill="var(--text-fraco)" fontSize="11">
                {faixa.name}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
