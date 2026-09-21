import { useEffect, useState } from 'react'
import { api, type Status } from './lib/api.ts'
import { useLanguage } from './lib/language.tsx'
import { Today } from './components/Today.tsx'
import { Rhythm } from './components/Rhythm.tsx'
import { Work } from './components/Work.tsx'
import { Journal } from './components/Journal.tsx'
import { Chat } from './components/Chat.tsx'
import { Settings } from './components/Settings.tsx'
import { Onboarding } from './components/Onboarding.tsx'
import {
  Badge, IconToday, IconRhythm, IconWork, IconJournal, IconChat, IconSettings,
} from './components/Icons.tsx'

type Tab = 'today' | 'rhythm' | 'work' | 'journal' | 'chat' | 'settings'

export function App() {
  const { t, settings } = useLanguage()
  const [tab, setTab] = useState<Tab>('today')
  const [status, setStatus] = useState<Status | null>(null)
  const [noCore, setSemNucleo] = useState(false)

  useEffect(() => {
    const search = () => api.status().then((s) => { setStatus(s); setSemNucleo(false) }).catch(() => setSemNucleo(true))
    search()
    const timer = setInterval(search, 15_000)
    return () => clearInterval(timer)
  }, [])

  const tabs: { id: Tab; name: string; Icon: () => React.ReactElement }[] = [
    { id: 'today', name: t.tabs.today, Icon: IconToday },
    { id: 'rhythm', name: t.tabs.rhythm, Icon: IconRhythm },
    { id: 'work', name: t.tabs.work, Icon: IconWork },
    { id: 'journal', name: t.tabs.journal, Icon: IconJournal },
    { id: 'chat', name: t.tabs.chat, Icon: IconChat },
    { id: 'settings', name: t.tabs.settings, Icon: IconSettings },
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
          {tabs.map(({ id, name, Icon }) => (
            <button key={id} className="tab" aria-current={tab === id} onClick={() => setTab(id)}>
              <Icon />
              {name}
            </button>
          ))}
        </nav>

        <div className="rail-foot">
          <div className="signal">
            <i className={`dot ${measuring ? (idle ? 'warm' : 'alive') : ''}`} />
            {noCore ? t.status.coreDown
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
                <i className={`dot ${status.jev ? 'alive' : ''}`} />jev
              </div>
              <div className="signal" title={t.status.narrative}>
                <i className={`dot ${status.claude ? 'alive' : ''}`} />claude code
              </div>
              <div className="signal" title={t.today.windows}>
                {/* Unknown is neither lit nor amber: it is simply not saying. */}
                <i className={`dot ${status.collector.trusted === true ? 'alive'
                  : status.collector.trusted === false ? 'warm' : ''}`} />{t.status.accessibility}
              </div>
              {Object.entries(status.collector.sources ?? {})
                .filter(([, state]) => state !== 'ok' && state !== 'never')
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
        {noCore && tab !== 'settings' ? (
          <div className="panel" style={{ marginTop: 60, padding: '44px 24px', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-mid)' }}>{t.status.noCore}</p>
            <p className="note">{t.status.startItWith} <code>npm run dev:core</code>.</p>
          </div>
        ) : tab === 'today' ? <Today status={status} />
          : tab === 'rhythm' ? <Rhythm />
          : tab === 'work' ? <Work />
          : tab === 'journal' ? <Journal status={status} />
          : tab === 'settings' ? <Settings />
          : <Chat status={status} />}
      </main>

      {/* The first run, until it is finished or skipped; Settings can bring it back. */}
      {settings && !settings.onboarded && !noCore && <Onboarding status={status} />}
    </div>
  )
}
