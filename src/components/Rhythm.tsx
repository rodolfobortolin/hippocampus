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
  const [janela, setJanela] = useState(30)
  const [data, setDados] = useState<Period | null>(null)

  useEffect(() => {
    let vivo = true
    const to = diaDeHoje()
    api.period(addDays(to, -(janela - 1)), to).then((d) => vivo && setDados(d))
    return () => { vivo = false }
  }, [janela])

  if (!data) return <p className="vazio">{t.today.loading}</p>

  const { summary } = data
  const measured = data.days.filter((d) => d.active > 60)
  const mean = measured.length ? summary.total / measured.length : 0
  const total = hours(summary.total)
  const longest = [...measured].sort((a, b) => b.active - a.active)[0]

  return (
    <>
      <div className="topo">
        <div>
          <h2><b>{t.rhythm.title}</b></h2>
          <p>{plural(measured.length, t.counts.day)} {t.rhythm.between} {data.of} {t.rhythm.and} {data.to}</p>
        </div>
        <div className="navega">
          {WINDOWS.map((opcao) => (
            <button key={opcao.days} onClick={() => setJanela(opcao.days)}
              className={janela === opcao.days ? 'ativo' : ''}>{opcao.name}</button>
          ))}
        </div>
      </div>

      {!measured.length ? (
        <div className="painel" style={{ padding: '40px 20px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-medio)' }}>{t.rhythm.noDays}</p>
          <p className="nota">{t.rhythm.rhythmAppears}</p>
        </div>
      ) : (
        <div className="grade" style={{ gap: 14 }}>
          <div className="grade g4">
            <div className="painel">
              <div className="rotulo">{t.rhythm.totalTime}</div>
              <div className="numero brilha">{total.value}<small>{total.unit}</small></div>
              <div className="nota">{t.common.averageOf} {duration(mean)} {t.rhythm.perDay}</div>
            </div>
            <div className="painel">
              <div className="rotulo">{t.rhythm.averageFocus}</div>
              <div className="numero brasa">{Math.round(summary.focusRatio * 100)}<small>%</small></div>
              <div className="nota">{t.rhythm.averageFocusNote}</div>
            </div>
            <div className="painel">
              <div className="rotulo">{t.rhythm.longestDay}</div>
              <div className="numero" style={{ fontSize: 30 }}>{duration(longest?.active ?? 0)}</div>
              <div className="nota">{longest?.day}</div>
            </div>
            <div className="painel">
              <div className="rotulo">{t.rhythm.output}</div>
              <div className="numero" style={{ fontSize: 30 }}>{number(summary.commits)}<small> {t.rhythm.commits}</small></div>
              <div className="nota">
                {summary.agents.length
                  ? summary.agents.map((a) => `${duration(a.minutes * 60)} ${t.common.of} ${a.name}`).join(' · ')
                  : plural(summary.aiTurns, t.counts.aiRequest)}
              </div>
            </div>
          </div>

          <div className="painel">
            <h3>{t.rhythm.whenYouWork} <em>{t.rhythm.hourByWeekday}</em></h3>
            <Heatmap grid={data.rhythm} />
          </div>

          {measured.length >= 3 && (
            <div className="painel">
              <h3>{t.rhythm.trend} <em>{t.rhythm.activeTimePerDay}</em></h3>
              <Trend days={data.days} />
            </div>
          )}

          <div className="grade g32">
            <div className="painel">
              <h3>{t.rhythm.whereTimeWent}</h3>
              <Bars items={topSlices(summary.apps)} total={summary.total} tone="var(--brasa)" />
            </div>
            <div className="painel">
              <h3>{t.rhythm.byCategory}</h3>
              <Donut slices={summary.categories} total={summary.total} />
            </div>
          </div>

          <div className="grade g2">
            <div className="painel">
              <h3>{t.rhythm.projects}</h3>
              {summary.projects.length
                ? <Bars items={summary.projects} total={summary.total} tone="var(--agua)" />
                : <p className="vazio">{t.rhythm.noProject}</p>}
            </div>

            <div className="painel">
              <h3>{t.rhythm.signature}</h3>
              {summary.shortcuts.length ? (
                <div className="legenda" style={{ marginTop: 0 }}>
                  {summary.shortcuts.map((atalho) => (
                    <span key={atalho.name} className="pilula" style={{ fontSize: 12.5, padding: '5px 11px' }}>
                      <b style={{ fontWeight: 500 }}>{atalho.name}</b>
                      <span style={{ color: 'var(--text-fraco)' }}>×{atalho.n}</span>
                    </span>
                  ))}
                </div>
              ) : <p className="vazio">{t.rhythm.noShortcuts}</p>}

              <h3 style={{ marginTop: 22 }}>{t.rhythm.sites}</h3>
              <div className="linhas">
                {summary.hosts.slice(0, 7).map((host) => (
                  <div key={host.name} className="linha">
                    <span className="nome">{host.name}</span>
                    <span className="valor">{number(host.n)}</span>
                  </div>
                ))}
              </div>

              {summary.typing.chars > 0 && (
                <div className="nota" style={{ marginTop: 16 }}>
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
