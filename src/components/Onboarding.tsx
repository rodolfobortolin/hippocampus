import { useEffect, useState } from 'react'
import { api, type Status } from '../lib/api.ts'
import { useLanguage } from '../lib/language.tsx'
import { LANGUAGES, type Language } from '../lib/strings.ts'
import { Badge } from './Icons.tsx'
import { Owners } from './Owners.tsx'
import { CodeFolders } from './CodeFolders.tsx'

/**
 * The first run: what the app is, what stays where, and the few things it
 * cannot guess — the permissions, where the code lives, the vault, and which
 * services, if any, the person wants.
 *
 * It says plainly what each service sees. There is no server of ours and the
 * database never leaves the Mac, but Claude Code, TypeSafe and OpenAI do see
 * parts of the day when they are turned on, and a walkthrough that promised
 * otherwise would be the first thing it said that was not true. Every service
 * can be skipped; with all of them skipped the app still measures and draws.
 *
 * Every step is optional and can be changed later in Settings. Skipping the
 * whole walkthrough is one click, and it can be seen again from Settings.
 */

// The language comes first: it decides the words of every step after it.
// Whose each thing is comes right after the code folder: the repositories it
// finds there are most of what it has to ask about.
const STEPS = ['you', 'welcome', 'permissions', 'code', 'owners', 'vault', 'services', 'extras', 'done'] as const
type Step = typeof STEPS[number]

type Bridge = {
  chooseFolder?: (message: string) => Promise<string | null>
  openAccessibility?: () => void
}
const bridge = (globalThis as any).hippocampus as Bridge | undefined

export function Onboarding({ status: initial }: { status: Status | null }) {
  const { t, language, settings, save } = useLanguage()
  const o = t.onboarding
  const [index, setIndex] = useState(0)
  const [direction, setDirection] = useState(1)
  const [instant, setInstant] = useState(false)
  const [status, setStatus] = useState<Status | null>(initial)
  const [name, setName] = useState(settings?.name ?? '')
  // How many repositories the chosen folders hold, all of them together.
  const [repos, setRepos] = useState<number | null>(null)
  const [blocked, setBlocked] = useState<string[]>([])
  const [typesafe, setTypesafe] = useState('')
  const [openai, setOpenai] = useState('')
  const step: Step = STEPS[index]

  // The steps that show something live — a permission being granted, the
  // first sample arriving — look again every two seconds while they are open.
  useEffect(() => {
    if (step !== 'permissions' && step !== 'done' && step !== 'services') return
    let alive = true
    const look = () => {
      api.status().then((s) => alive && setStatus(s)).catch(() => {})
      if (step === 'permissions') api.blocked().then((b) => alive && setBlocked(b.browsers)).catch(() => {})
    }
    look()
    const timer = setInterval(look, 2000)
    return () => { alive = false; clearInterval(timer) }
  }, [step])


  if (!settings) return null

  // From a pointer, the step slides in from the side it came from; from the
  // keyboard it simply changes — a keyboard action is never animated.
  const go = (delta: number, event?: React.MouseEvent) => {
    if (step === 'you' && name.trim() && name.trim() !== settings.name) void save({ name: name.trim() })
    setDirection(delta)
    setInstant(!!event && event.detail === 0)
    setIndex((i) => Math.max(0, Math.min(STEPS.length - 1, i + delta)))
  }
  const finish = () => save({ onboarded: true })

  const chooseVault = async () => {
    const chosen = await bridge?.chooseFolder?.(o.pickVault)
    if (chosen) await save({ vault: chosen })
  }

  const trusted = status?.collector.trusted
  const browsersState = status?.collector.sources?.browsers
  const sample = status?.collector.lastSample

  const body = (() => {
    switch (step) {
      case 'welcome':
        return (
          <>
            <h1>{o.welcomeTitle}</h1>
            <p className="onb-lead">{o.welcomeLead}</p>
            <div className="onb-points">
              <div style={{ '--c': 'var(--water)' } as React.CSSProperties}><b>{o.noServer}</b><span>{o.noServerText}</span></div>
              <div style={{ '--c': 'var(--gold)' } as React.CSSProperties}><b>{o.oneFile}</b><span>{o.oneFileText}</span></div>
              <div style={{ '--c': 'var(--ember)' } as React.CSSProperties}><b>{o.yourServices}</b><span>{o.yourServicesText}</span></div>
            </div>
          </>
        )
      case 'you':
        // Picking a language rewrites this very screen in it, and every one after.
        return (
          <>
            <div className="onb-mark"><Badge /></div>
            <h1>{o.youTitle}</h1>
            <p className="onb-lead">{o.youText}</p>
            <div className="languages onb-languages">
              {(Object.keys(LANGUAGES) as Language[]).map((code) => (
                <button key={code} className={`pill ${code === language ? 'active' : ''}`}
                  aria-pressed={code === language} onClick={() => save({ language: code })}>
                  <b>{LANGUAGES[code].flag}</b> {LANGUAGES[code].name}
                </button>
              ))}
            </div>
            <input className="onb-input" value={name} placeholder={t.settings.name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => name.trim() && name.trim() !== settings.name && save({ name: name.trim() })} />
          </>
        )
      case 'permissions':
        return (
          <>
            <h1>{o.permissionsTitle}</h1>
            <p className="onb-lead">{o.permissionsText}</p>
            <div className="onb-rows">
              <div className="onb-row">
                <div><b>{o.accessibility}</b><span>{o.accessibilityText}</span></div>
                {trusted === true ? <span className="onb-state ok">{o.granted}</span> : (
                  <div className="onb-actions">
                    <button className="onb-button" onClick={() => void api.askAccessibility()}>{o.allow}</button>
                    {bridge?.openAccessibility && (
                      <button className="onb-link" onClick={() => bridge.openAccessibility!()}>{o.openSettings}</button>
                    )}
                  </div>
                )}
              </div>
              <div className="onb-row">
                <div>
                  <b>{o.browsers}</b><span>{o.browsersText}</span>
                  {blocked.length > 0 && <span className="onb-warn">{o.browsersDenied(blocked.join(', '))}</span>}
                </div>
                {browsersState === 'ok' && !blocked.length ? <span className="onb-state ok">{o.granted}</span>
                  : blocked.length || browsersState === 'no-permission'
                    ? <button className="onb-button" onClick={() => void api.retryBlocked()}>{o.tryAgain}</button>
                    : <span className="onb-state">{o.waiting}</span>}
              </div>
            </div>
          </>
        )
      case 'code':
        return (
          <>
            <h1>{o.codeTitle}</h1>
            <p className="onb-lead">{o.codeText}</p>
            <CodeFolders onCount={setRepos} />
          </>
        )
      case 'owners':
        return (
          <>
            <h1>{t.owners.title}</h1>
            <p className="onb-lead">{t.owners.lead}</p>
            <Owners scan />
          </>
        )
      case 'vault':
        return (
          <>
            <div className="onb-mark"><img src="/logos/obsidian.webp" alt="" width={44} height={44} /></div>
            <h1>{o.vaultTitle}</h1>
            <p className="onb-lead">{o.vaultText}</p>
            <div className="onb-folder">
              <code title={settings.vault}>{settings.vault || t.settings.noVault}</code>
              {bridge?.chooseFolder && <button className="onb-button" onClick={() => void chooseVault()}>{o.choose}</button>}
            </div>
          </>
        )
      case 'services':
        return (
          <>
            <h1>{o.servicesTitle}</h1>
            <p className="onb-lead">{o.servicesText}</p>
            <div className="onb-rows">
              <div className="onb-row service">
                <img src="/logos/claude.webp" alt="" width={30} height={30} />
                <div><b>{o.claude}</b><span>{o.claudeSees}</span></div>
                <span className={`onb-state ${status?.claude ? 'ok' : ''}`}>{status?.claude ? o.claudeFound : o.claudeMissing}</span>
              </div>
              <div className="onb-row service">
                <img src="/logos/typesafe.png" alt="" width={30} height={30} className="rounded" />
                <div><b>{o.typesafe}</b><span>{o.typesafeSees}</span></div>
                {settings.keys.jev === 'keychain' ? <span className="onb-state ok">{o.keyStored}</span> : (
                  <div className="onb-key">
                    <input type="password" value={typesafe} placeholder={o.keyPlaceholder} onChange={(e) => setTypesafe(e.target.value)} />
                    <button className="onb-button" disabled={!typesafe.trim()}
                      onClick={() => { void save({ keys: { jev: typesafe.trim() } }); setTypesafe('') }}>{t.settings.save}</button>
                  </div>
                )}
              </div>
              <div className="onb-row service">
                <span className="onb-voice" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="18" height="18"><rect x="9" y="3" width="6" height="11" rx="3" fill="none" stroke="currentColor" strokeWidth="1.7" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
                </span>
                <div><b>{o.openai}</b><span>{o.openaiSees}</span></div>
                {settings.keys.openai === 'keychain' ? <span className="onb-state ok">{o.keyStored}</span> : (
                  <div className="onb-key">
                    <input type="password" value={openai} placeholder={o.keyPlaceholder} onChange={(e) => setOpenai(e.target.value)} />
                    <button className="onb-button" disabled={!openai.trim()}
                      onClick={() => { void save({ keys: { openai: openai.trim() } }); setOpenai('') }}>{t.settings.save}</button>
                  </div>
                )}
              </div>
            </div>
          </>
        )
      case 'extras':
        return (
          <>
            <h1>{o.extrasTitle}</h1>
            <div className="onb-rows">
              <div className="onb-row">
                <div><b>{t.settings.calendar}</b><span>{t.settings.calendarNote}</span></div>
                <button className={`switch ${settings.calendar ? 'active' : ''}`} aria-pressed={settings.calendar}
                  onClick={() => save({ calendar: !settings.calendar })}><i /></button>
              </div>
              <div className="onb-row">
                <div><b>{t.settings.captures}</b><span>{t.settings.capturesNote}</span></div>
                <button className={`switch ${settings.captures ? 'active' : ''}`} aria-pressed={settings.captures}
                  onClick={() => save({ captures: !settings.captures })}><i /></button>
              </div>
              <div className="onb-row">
                <div><b>{t.settings.timesheet}</b><span>{t.settings.timesheetNote}</span></div>
                <button className={`switch ${settings.timesheet ? 'active' : ''}`} aria-pressed={settings.timesheet}
                  onClick={() => save({ timesheet: !settings.timesheet })}><i /></button>
              </div>
            </div>
          </>
        )
      case 'done':
        return (
          <>
            <h1>{o.doneTitle}</h1>
            <p className="onb-lead">{o.doneText}</p>
            <div className="onb-live">
              <i className={`dot ${sample?.app ? 'alive' : ''}`} />
              <span className="onb-live-label">{o.nowInFocus}</span>
              <b>{sample?.app ?? o.noSampleYet}</b>
              {sample?.title && <span className="onb-live-title">{sample.title}</span>}
            </div>
          </>
        )
    }
  })()

  // A step that is only a choice to make can be passed over with its own words.
  const passOver = step === 'code' && !repos ? o.noCode : step === 'vault' && !settings.vault ? o.notNow : null

  return (
    <div className="onboarding" role="dialog" aria-modal="true" aria-label={o.welcomeTitle}>
      {/* It covers the app's own drag strip, so it carries one: the window
          still moves by its top edge while the walkthrough is open. */}
      <div className="onb-drag" />
      <div className="onb-top">
        <div className="onb-progress" aria-label={o.stepOf(index + 1, STEPS.length)}>
          <i style={{ transform: `scaleX(${(index + 1) / STEPS.length})` }} />
        </div>
        {step !== 'done' && <button className="onb-link" onClick={finish}>{o.skip}</button>}
      </div>

      <div key={step} className={`onb-step ${instant ? 'instant' : ''}`}
        style={{ '--dir': direction } as React.CSSProperties}>
        {body}
      </div>

      <div className="onb-foot">
        {index > 0 ? <button className="onb-link" onClick={(e) => go(-1, e)}>{o.back}</button> : <span />}
        <span className="onb-count">{o.stepOf(index + 1, STEPS.length)}</span>
        {step === 'done'
          ? <button className="onb-button primary" onClick={finish}>{o.start}</button>
          : <button className="onb-button primary" onClick={(e) => go(1, e)}>{passOver ?? o.next}</button>}
      </div>
    </div>
  )
}
