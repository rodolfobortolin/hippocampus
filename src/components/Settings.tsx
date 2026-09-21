import { useCallback, useEffect, useState } from 'react'
import pkg from '../../package.json'
import { useLanguage } from '../lib/language.tsx'
import { api } from '../lib/api.ts'
import { LANGUAGES, type Language } from '../lib/strings.ts'
import { IconKey, IconFolder } from './Icons.tsx'

/**
 * The vault's path fits on one line only if it is cut from the front — what
 * identifies the folder is its end, not the `/Users/someone` every folder has.
 */
function shortPath(route: string): string {
  const parts = route.replace(/\/$/, '').split('/').filter(Boolean)
  return parts.length > 3 ? `…/${parts.slice(-3).join('/')}` : route
}

/**
 * A pressed key combination, in the form Electron's accelerators use.
 *
 * A modifier on its own is not a shortcut — it is the person still reaching for
 * the second key — so those return empty and the field keeps waiting.
 */
function accelerator(event: React.KeyboardEvent): string {
  const held = [
    event.metaKey && 'CommandOrControl',
    event.ctrlKey && !event.metaKey && 'CommandOrControl',
    event.altKey && 'Alt',
    event.shiftKey && 'Shift',
  ].filter(Boolean) as string[]
  const key = event.key
  if (['Meta', 'Control', 'Alt', 'Shift'].includes(key)) return ''
  const named: Record<string, string> = {
    ' ': 'Space', ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
    Escape: 'Esc', Enter: 'Return',
  }
  const last = named[key] ?? (key.length === 1 ? key.toUpperCase() : key)
  // Without a modifier the combination would swallow a plain letter everywhere
  // on the machine, including inside whatever the person is typing in.
  if (!held.length) return ''
  return [...held, last].join('+')
}

/** How a stored accelerator reads on screen. */
function shortcutLabel(accel: string): string {
  return accel
    .replace('CommandOrControl', '⌘')
    .replace('Alt', '⌥')
    .replace('Shift', '⇧')
    .replace('Control', '⌃')
    .split('+')
    .join(' ')
}

/** Electron exposes the folder picker; in a plain browser it simply does not exist. */
type AgentStates = Record<string, { status: string; on: boolean }>

const bridge = (globalThis as any).hippocampus as {
  chooseFolder?: (message?: string) => Promise<string | null>
  setShortcut?: (accelerator: string) => Promise<{ ok: boolean; shortcut: string }>
  agents?: {
    status: () => Promise<AgentStates | null>
    register: () => Promise<unknown>
    unregister: () => Promise<unknown>
  }
} | undefined

function Field({ label, note, children }: { label: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="setting">
      <div className="setting-label">
        {label}
        {note && <span>{note}</span>}
      </div>
      <div className="setting-field">{children}</div>
    </div>
  )
}

/** Where the lunch button goes; empty until the payment link exists. */
const LUNCH: string = (pkg as { funding?: { url?: string } }).funding?.url ?? ''

export function Settings() {
  const { t, language, settings, save } = useLanguage()
  const [name, setName] = useState('')
  const [journalFolder, setJournalFolder] = useState('')
  const [jev, setJev] = useState('')
  const [openai, setOpenai] = useState('')
  const [state, setState] = useState<'' | 'saving' | 'saved'>('')
  const [agents, setAgents] = useState<AgentStates | null>(null)
  const [capturing, setCapturing] = useState(false)
  const [shortcutTaken, setShortcutTaken] = useState(false)
  const [repos, setRepos] = useState<{ repos: number; readable: boolean } | null>(null)

  // The text fields only sync when the settings arrive or change from outside;
  // while the person is typing, what is on screen is what wins.
  useEffect(() => {
    if (!settings) return
    setName(settings.name)
    setJournalFolder(settings.journalFolder)
  }, [settings])

  const readAgents = useCallback(() => {
    bridge?.agents?.status().then(setAgents).catch(() => setAgents(null))
  }, [])
  useEffect(readAgents, [readAgents])
  useEffect(() => {
    if (settings?.codeRoot) api.repos(settings.codeRoot).then(setRepos).catch(() => setRepos(null))
  }, [settings?.codeRoot])

  if (!settings) return <p className="empty">{t.today.loading}</p>

  // The registrar returns a code, not a sentence — matching against translated
  // text to know what happened would break the moment someone switched language.
  const states = Object.values(agents ?? {})
  const allOn = states.length > 0 && states.every((a) => a.on)
  const awaitingApproval = states.some((a) => a.status === 'needs-approval')

  const store = async (change: Parameters<typeof save>[0]) => {
    setState('saving')
    try {
      await save(change)
      setState('saved')
      setTimeout(() => setState(''), 1800)
    } catch {
      setState('')
    }
  }

  const chooseFolder = async () => {
    const chosen = await bridge?.chooseFolder?.(t.onboarding.pickVault)
    if (chosen) void store({ vault: chosen })
  }
  const chooseCode = async () => {
    const chosen = await bridge?.chooseFolder?.(t.onboarding.pickCode)
    if (!chosen) return
    await store({ codeRoot: chosen })
    setRepos(await api.repos(chosen).catch(() => null))
  }

  const keyLabel = (which: 'jev' | 'openai') => {
    const where = settings.keys[which]
    return where === 'keychain' ? t.settings.inTheKeychain
      : where === 'environment' ? `${t.settings.isSet} · .env`
      : t.settings.notSet
  }

  return (
    <>
      <div className="top">
        <div>
          <h2><b>{t.settings.title}</b></h2>
          <p>{t.settings.subtitle}</p>
        </div>
        {state && <div className="nav"><span className="pill">{state === 'saving' ? t.settings.saving : t.settings.saved}</span></div>}
      </div>

      <div className="grid" style={{ gap: 14 }}>
        <div className="panel">
          <h3>{t.settings.language}<em>{t.settings.languageNote}</em></h3>
          <div className="languages">
            {(Object.keys(LANGUAGES) as Language[]).map((code) => (
              <button key={code} className={`pill ${code === language ? 'active' : ''}`}
                onClick={() => store({ language: code })}>
                <b>{LANGUAGES[code].flag}</b> {LANGUAGES[code].name}
              </button>
            ))}
          </div>

          <Field label={t.settings.name} note={t.settings.nameNote}>
            <input value={name} onChange={(e) => setName(e.target.value)}
              onBlur={() => name.trim() && name !== settings.name && store({ name: name.trim() })} />
          </Field>

          <Field label={t.settings.day} note={t.settings.dayNote}>
            <select value={settings.dayStartHour}
              onChange={(e) => store({ dayStartHour: Number(e.target.value) })}>
              {Array.from({ length: 13 }, (_, h) => (
                <option key={h} value={h}>{String(h).padStart(2, '0')}{t.settings.hourSuffix}</option>
              ))}
            </select>
          </Field>

          {bridge?.setShortcut && (
            <Field label={t.settings.shortcut} note={t.settings.shortcutNote}>
              <div className="path">
                <button
                  className={`pill ${capturing ? 'active' : ''}`}
                  onFocus={() => { setCapturing(true); setShortcutTaken(false) }}
                  onBlur={() => setCapturing(false)}
                  onKeyDown={async (event) => {
                    event.preventDefault()
                    const combination = accelerator(event)
                    if (!combination) return
                    const answer = await bridge.setShortcut!(combination)
                    setShortcutTaken(!answer.ok)
                    if (answer.ok) {
                      void store({ shortcut: combination })
                      event.currentTarget.blur()
                    }
                  }}>
                  {capturing ? t.settings.shortcutPress
                    : settings.shortcut ? shortcutLabel(settings.shortcut)
                    : t.settings.shortcutOff}
                </button>
                {settings.shortcut && !capturing && (
                  <button onClick={async () => {
                    await bridge.setShortcut!('')
                    void store({ shortcut: '' })
                  }}>{t.settings.shortcutClear}</button>
                )}
              </div>
              {shortcutTaken && <p className="note">{t.settings.shortcutTaken}</p>}
            </Field>
          )}

          <Field label={t.settings.voiceMode} note={t.settings.voiceModeNote}>
            <div className="languages">
              <button
                className={`pill ${settings.voiceMode !== 'live' ? 'active' : ''}`}
                onClick={() => store({ voiceMode: 'push' })}>
                {t.settings.voicePush}
              </button>
              <button
                className={`pill ${settings.voiceMode === 'live' ? 'active' : ''}`}
                disabled={!settings.liveAvailable}
                title={settings.liveAvailable ? undefined : t.settings.voiceLiveNeedsKey}
                onClick={() => store({ voiceMode: 'live' })}>
                {t.settings.voiceLive}
              </button>
            </div>
            <p className="note">
              {settings.voiceMode === 'live' ? t.settings.voiceLiveNote : t.settings.voicePushNote}
            </p>
          </Field>

          <Field label={t.settings.region} note={t.settings.regionNote}>
            <div className="languages">
              <button
                className={`pill ${settings.region !== 'eu' ? 'active' : ''}`}
                onClick={() => store({ region: 'global' })}>
                {t.settings.regionGlobal}
              </button>
              <button
                className={`pill ${settings.region === 'eu' ? 'active' : ''}`}
                onClick={() => store({ region: 'eu' })}>
                {t.settings.regionEu}
              </button>
            </div>
          </Field>

          {settings.voiceMode === 'live' && (
            <Field label={t.settings.liveVoiceLabel}>
              <select value={settings.liveVoice}
                onChange={(e) => store({ liveVoice: e.target.value })}>
                {(settings.liveVoices ?? []).map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </Field>
          )}

          <Field label={t.settings.caption} note={t.settings.captionNote}>
            <button className={`switch ${settings.caption !== false ? 'active' : ''}`}
              onClick={() => store({ caption: settings.caption === false })}>
              <i />
            </button>
          </Field>

          <Field
            label={t.settings.wideTools}
            note={settings.wideTools ? t.settings.wideToolsOn : t.settings.wideToolsNote}>
            <button className={`switch ${settings.wideTools ? 'active' : ''}`}
              onClick={() => store({ wideTools: !settings.wideTools })}>
              <i />
            </button>
          </Field>

          <Field
            label={t.settings.calendar}
            note={!settings.calendar ? t.settings.calendarNote
              : settings.calendarStatus === 'denied' ? t.settings.calendarDenied
              : settings.calendarStatus === 'granted' ? t.settings.calendarGranted
              : t.settings.calendarWaiting}>
            <button className={`switch ${settings.calendar ? 'active' : ''}`}
              onClick={() => store({ calendar: !settings.calendar })}>
              <i />
            </button>
          </Field>

          <Field label={t.settings.timesheet} note={t.settings.timesheetNote}>
            <button className={`switch ${settings.timesheet ? 'active' : ''}`}
              onClick={() => store({ timesheet: !settings.timesheet })}>
              <i />
            </button>
          </Field>

          <Field label={t.settings.captures} note={t.settings.capturesNote}>
            <button className={`switch ${settings.captures ? 'active' : ''}`}
              onClick={() => store({ captures: !settings.captures })}>
              <i />
            </button>
          </Field>

          <Field label={t.settings.keepTyping} note={t.settings.keepTypingNote}>
            <button className={`switch ${settings.keepTyping ? 'active' : ''}`}
              onClick={() => store({ keepTyping: !settings.keepTyping })}>
              <i />
            </button>
          </Field>
        </div>

        <div className="panel">
          <h3><IconFolder /> {t.settings.codeFolder}<em>{t.settings.codeFolderNote}</em></h3>
          <Field label={t.onboarding.choose}
            note={repos ? (!repos.readable ? t.onboarding.unreadable : repos.repos ? t.onboarding.reposFound(repos.repos) : t.onboarding.noRepos) : undefined}>
            <div className="path">
              <code title={settings.codeRoot}>{shortPath(settings.codeRoot)}</code>
              {bridge?.chooseFolder && <button onClick={chooseCode}>{t.onboarding.choose}</button>}
            </div>
          </Field>
        </div>

        <div className="panel">
          <h3><IconFolder /> {t.settings.vault}<em>{t.settings.vaultNote}</em></h3>
          <Field label={t.settings.chooseFolder}>
            <div className="path">
              <code title={settings.vault}>{settings.vault ? shortPath(settings.vault) : t.settings.noVault}</code>
              {bridge?.chooseFolder && <button onClick={chooseFolder}>{t.settings.chooseFolder}</button>}
            </div>
          </Field>
          <Field label={t.settings.journalSubfolder}>
            <input value={journalFolder} onChange={(e) => setJournalFolder(e.target.value)}
              onBlur={() => journalFolder !== settings.journalFolder && store({ journalFolder })} />
          </Field>
        </div>

        {agents && (
          <div className="panel">
            <h3>{t.settings.agents}<em>{t.settings.agentsNote}</em></h3>
            <Field
              label={
                allOn ? t.settings.agentsOn
                  : awaitingApproval ? t.settings.agentsApprove
                  : t.settings.agentsOff
              }
              note={allOn ? undefined : t.settings.agentsWhere}>
              <button
                className={`switch ${allOn ? 'active' : ''}`}
                onClick={async () => {
                  await (allOn ? bridge?.agents?.unregister() : bridge?.agents?.register())
                  readAgents()
                }}>
                <i />
              </button>
            </Field>
          </div>
        )}

        <div className="panel">
          <h3><IconKey /> {t.settings.keys}<em>{t.settings.keysNote}</em></h3>

          <Field label={t.settings.jevKey} note={t.settings.jevNote}>
            <div className="path">
              <input type="password" value={jev} placeholder={keyLabel('jev')}
                onChange={(e) => setJev(e.target.value)} />
              <button disabled={!jev.trim()}
                onClick={() => { void store({ keys: { jev: jev.trim() } }); setJev('') }}>
                {t.settings.save}
              </button>
              {settings.keys.jev === 'keychain' && (
                <button onClick={() => store({ keys: { jev: '' } })}>{t.settings.remove}</button>
              )}
            </div>
          </Field>

          <Field label={`${t.settings.openaiKey} · ${t.settings.optional}`} note={t.settings.openaiNote}>
            <div className="path">
              <input type="password" value={openai} placeholder={keyLabel('openai')}
                onChange={(e) => setOpenai(e.target.value)} />
              <button disabled={!openai.trim()}
                onClick={() => { void store({ keys: { openai: openai.trim() } }); setOpenai('') }}>
                {t.settings.save}
              </button>
              {settings.keys.openai === 'keychain' && (
                <button onClick={() => store({ keys: { openai: '' } })}>{t.settings.remove}</button>
              )}
            </div>
          </Field>
        </div>

        <div className="panel">
          <Field label={t.settings.introAgain}>
            <button onClick={() => store({ onboarded: false })}>{t.settings.introAgain}</button>
          </Field>
          {/* The one ask in the app, at the very end of the settings, and only
              once there is somewhere for it to go. It opens the browser; nothing
              about the day travels with it. */}
          {LUNCH && (
            <Field label={t.settings.lunch} note={t.settings.lunchNote}>
              <button onClick={() => window.open(LUNCH, '_blank')}>{t.settings.lunchButton}</button>
            </Field>
          )}
        </div>
      </div>
    </>
  )
}
