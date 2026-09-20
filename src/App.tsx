import { useEffect, useState } from 'react'
import { api, type Status } from './lib/api.ts'
import { useLanguage } from './lib/language.tsx'
import { Today } from './components/Today.tsx'
import { Rhythm } from './components/Rhythm.tsx'
import { Journal } from './components/Journal.tsx'
import { Chat } from './components/Chat.tsx'
import { Settings } from './components/Settings.tsx'
import {
  Badge, IconToday, IconRhythm, IconJournal, IconChat, IconSettings,
} from './components/Icons.tsx'

type Aba = 'hoje' | 'ritmo' | 'diario' | 'conversa' | 'ajustes'

export function App() {
  const t = useLanguage().t
  const [aba, setAba] = useState<Aba>('hoje')
  const [status, setStatus] = useState<Status | null>(null)
  const [semNucleo, setSemNucleo] = useState(false)

  useEffect(() => {
    const search = () => api.status().then((s) => { setStatus(s); setSemNucleo(false) }).catch(() => setSemNucleo(true))
    search()
    const timer = setInterval(search, 15_000)
    return () => clearInterval(timer)
  }, [])

  const tabs: { id: Aba; name: string; Icone: () => React.ReactElement }[] = [
    { id: 'hoje', name: t.tabs.today, Icone: IconToday },
    { id: 'ritmo', name: t.tabs.rhythm, Icone: IconRhythm },
    { id: 'diario', name: t.tabs.journal, Icone: IconJournal },
    { id: 'conversa', name: t.tabs.chat, Icone: IconChat },
    { id: 'ajustes', name: t.tabs.settings, Icone: IconSettings },
  ]

  const sample = status?.collector.lastSample
  const measuring = status?.collector.running && !!sample
  const idle = sample ? sample.idle > 120 || sample.locked : false

  return (
    <div className="app">
      {/* A drag strip across the whole top of the window. Without it only the
          sidebar caught, and moving the window was a hunt for the right pixel.
          It sits above
          tudo e nada interativo mora embaixo dela. */}
      <div className="drag" />

      <aside className="rail">
        <div className="brand">
          <Badge />
          <div>
            <h1>Hippocampus</h1>
            <span>{t.status.brand}</span>
          </div>
        </div>

        <nav>
          {tabs.map(({ id, name, Icone }) => (
            <button key={id} className="tab" aria-current={aba === id} onClick={() => setAba(id)}>
              <Icone />
              {name}
            </button>
          ))}
        </nav>

        <div className="rail-foot">
          <div className="signal">
            <i className={`ponto ${measuring ? (idle ? 'morno' : 'vivo') : ''}`} />
            {semNucleo ? t.status.coreDown
              : measuring ? (idle ? t.status.idle : t.status.measuring)
              : t.status.stopped}
          </div>
          {sample?.app && !idle && (
            // Not a service — it is what is in focus now. Without the label, a
            // line with no dot among the status dots reads as something
            // desligado, que foi exatamente o que aconteceu.
            <div className="in-focus" title={sample.title ?? sample.app}>
              <span>{t.status.inFocus}</span>
              <b>{sample.app === 'Electron' ? 'Hippocampus' : sample.app}</b>
              {sample.title && sample.title !== sample.app && <i>{sample.title}</i>}
            </div>
          )}
          {status && (
            <>
              <div className="signal" title={t.status.classification}>
                <i className={`ponto ${status.jev ? 'vivo' : ''}`} />jev
              </div>
              <div className="signal" title={t.status.narrative}>
                <i className={`ponto ${status.claude ? 'vivo' : ''}`} />claude code
              </div>
              <div className="signal" title={t.today.windows}>
                <i className={`ponto ${status.collector.trusted ? 'vivo' : 'morno'}`} />{t.status.accessibility}
              </div>
              {Object.entries(status.collector.sources ?? {})
                .filter(([, state]) => state !== 'ok' && state !== 'nunca')
                .map(([source, state]) => {
                  // A known code becomes a sentence in the person's language; what is not
                  // not known came from the system and goes through raw, because
                  // inventing a translation for a macOS error only hides the error.
                  const reason = (t.status.source as Record<string, string>)[state] ?? state
                  return (
                    <div key={source} className="signal" title={reason} style={{ color: 'var(--communication)' }}>
                      <i className="dot warm" />{source}: {reason}
                    </div>
                  )
                })}
            </>
          )}
        </div>
      </aside>

      <main className="screen">
        {semNucleo && aba !== 'ajustes' ? (
          <div className="panel" style={{ marginTop: 60, padding: '44px 24px', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-mid)' }}>{t.status.noCore}</p>
            <p className="note">{t.status.startItWith} <code>npm run dev:core</code>.</p>
          </div>
        ) : aba === 'hoje' ? <Today status={status} />
          : aba === 'ritmo' ? <Rhythm />
          : aba === 'diario' ? <Journal status={status} />
          : aba === 'ajustes' ? <Settings />
          : <Chat status={status} />}
      </main>
    </div>
  )
}
