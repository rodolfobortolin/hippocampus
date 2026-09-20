import { useCallback, useEffect, useState } from 'react'
import { useLanguage } from '../lib/language.tsx'
import { LANGUAGES, type Language } from '../lib/strings.ts'
import { IconKey, IconFolder } from './Icons.tsx'

/**
 * O caminho do vault cabe em uma linha só se for cortado pelo começo — o que
 * identifica a pasta é o end dele, não o `/Users/fulano` que toda pasta tem.
 */
function shortPath(caminho: string): string {
  const parts = caminho.replace(/\/$/, '').split('/').filter(Boolean)
  return parts.length > 3 ? `…/${parts.slice(-3).join('/')}` : caminho
}

/** O Electron expõe o seletor de pasta; no navegador ele simplesmente não existe. */
type AgentStates = Record<string, { status: string; connected: boolean }>

const bridge = (globalThis as any).hippocampus as {
  chooseFolder?: () => Promise<string | null>
  agents?: {
    status: () => Promise<AgentStates | null>
    register: () => Promise<unknown>
    unregister: () => Promise<unknown>
  }
} | undefined

function Field({ rotulo, nota, children }: { rotulo: string; nota?: string; children: React.ReactNode }) {
  return (
    <div className="ajuste">
      <div className="ajuste-rotulo">
        {rotulo}
        {nota && <span>{nota}</span>}
      </div>
      <div className="ajuste-campo">{children}</div>
    </div>
  )
}

export function Settings() {
  const { t, language, settings, save } = useLanguage()
  const [name, setNome] = useState('')
  const [journalFolder, setPastaDiario] = useState('')
  const [jev, setJev] = useState('')
  const [openai, setOpenai] = useState('')
  const [state, setState] = useState<'' | 'salvando' | 'salvo'>('')
  const [agentes, setAgentes] = useState<AgentStates | null>(null)

  // Os campos de text só se sincronizam quando os settings chegam ou mudam
  // por fora; enquanto a pessoa digita, quem manda é o que está na canvas.
  useEffect(() => {
    if (!settings) return
    setNome(settings.name)
    setPastaDiario(settings.journalFolder)
  }, [settings])

  const readAgents = useCallback(() => {
    bridge?.agents?.status().then(setAgentes).catch(() => setAgentes(null))
  }, [])
  useEffect(readAgents, [readAgents])

  if (!settings) return <p className="vazio">{t.today.loading}</p>

  // O registrador devolve código, não utterance — casar com text traduzido para
  // saber o que aconteceu quebraria assim que alguém trocasse de language.
  const states = Object.values(agentes ?? {})
  const allOn = states.length > 0 && states.every((a) => a.connected)
  const awaitingApproval = states.some((a) => a.status === 'requer-aprovacao')

  const store = async (mudanca: Parameters<typeof save>[0]) => {
    setState('salvando')
    try {
      await save(mudanca)
      setState('salvo')
      setTimeout(() => setState(''), 1800)
    } catch {
      setState('')
    }
  }

  const chooseFolder = async () => {
    const chosen = await bridge?.chooseFolder?.()
    if (chosen) void store({ vault: chosen })
  }

  const keyLabel = (qual: 'jev' | 'openai') => {
    const where = settings.keys[qual]
    return where === 'keychain' ? t.settings.inTheKeychain
      : where === 'environment' ? `${t.settings.isSet} · .env`
      : t.settings.notSet
  }

  return (
    <>
      <div className="topo">
        <div>
          <h2><b>{t.settings.title}</b></h2>
          <p>{t.settings.subtitle}</p>
        </div>
        {state && <div className="navega"><span className="pilula">{state === 'salvando' ? t.settings.saving : t.settings.saved}</span></div>}
      </div>

      <div className="grade" style={{ gap: 14 }}>
        <div className="painel">
          <h3>{t.settings.language}<em>{t.settings.languageNote}</em></h3>
          <div className="idiomas">
            {(Object.keys(LANGUAGES) as Language[]).map((chave) => (
              <button key={chave} className={`pilula ${chave === language ? 'ativo' : ''}`}
                onClick={() => store({ language: chave })}>
                <b>{LANGUAGES[chave].flag}</b> {LANGUAGES[chave].name}
              </button>
            ))}
          </div>

          <Field rotulo={t.settings.name} nota={t.settings.nameNote}>
            <input value={name} onChange={(e) => setNome(e.target.value)}
              onBlur={() => name.trim() && name !== settings.name && store({ name: name.trim() })} />
          </Field>

          <Field rotulo={t.settings.day} nota={t.settings.dayNote}>
            <select value={settings.dayStartHour}
              onChange={(e) => store({ dayStartHour: Number(e.target.value) })}>
              {Array.from({ length: 13 }, (_, h) => (
                <option key={h} value={h}>{String(h).padStart(2, '0')}{t.settings.hourSuffix}</option>
              ))}
            </select>
          </Field>

          <Field rotulo={t.settings.keepTyping} nota={t.settings.keepTypingNote}>
            <button className={`chave ${settings.keepTyping ? 'ativo' : ''}`}
              onClick={() => store({ keepTyping: !settings.keepTyping })}>
              <i />
            </button>
          </Field>
        </div>

        <div className="painel">
          <h3><IconFolder /> {t.settings.vault}<em>{t.settings.vaultNote}</em></h3>
          <Field rotulo={t.settings.chooseFolder}>
            <div className="caminho">
              <code title={settings.vault}>{settings.vault ? shortPath(settings.vault) : t.settings.noVault}</code>
              {bridge?.chooseFolder && <button onClick={chooseFolder}>{t.settings.chooseFolder}</button>}
            </div>
          </Field>
          <Field rotulo={t.settings.journalSubfolder}>
            <input value={journalFolder} onChange={(e) => setPastaDiario(e.target.value)}
              onBlur={() => journalFolder !== settings.journalFolder && store({ journalFolder })} />
          </Field>
        </div>

        {agentes && (
          <div className="painel">
            <h3>{t.settings.agents}<em>{t.settings.agentsNote}</em></h3>
            <Field
              rotulo={
                allOn ? t.settings.agentsOn
                  : awaitingApproval ? t.settings.agentsApprove
                  : t.settings.agentsOff
              }
              nota={allOn ? undefined : t.settings.agentsWhere}>
              <button
                className={`chave ${allOn ? 'ativo' : ''}`}
                onClick={async () => {
                  await (allOn ? bridge?.agents?.unregister() : bridge?.agents?.register())
                  readAgents()
                }}>
                <i />
              </button>
            </Field>
          </div>
        )}

        <div className="painel">
          <h3><IconKey /> {t.settings.keys}<em>{t.settings.keysNote}</em></h3>

          <Field rotulo={t.settings.jevKey} nota={t.settings.jevNote}>
            <div className="caminho">
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

          <Field rotulo={`${t.settings.openaiKey} · ${t.settings.optional}`} nota={t.settings.openaiNote}>
            <div className="caminho">
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
      </div>
    </>
  )
}
