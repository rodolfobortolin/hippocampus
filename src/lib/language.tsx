import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { LANGUAGES, STRINGS, type Language, type Strings } from './strings.ts'
import { CATEGORY_NAMES } from '../../core/languages.ts'
import { api, type Settings } from './api.ts'
import { setDayStartHour, setLocale } from './format.ts'

/**
 * The chosen language, available to the whole screen.
 *
 * The core is what stores the choice — it is the one writing the journal and
 * holding the conversation, and
 * os dois precisam concordar. A canvas question uma vez ao subir e store uma
 * a copy in the browser only so it does not flash the wrong language before
 * the answer arrives.
 */
type Context = {
  language: Language
  t: Strings
  settings: Settings | null
  /** A category's name in the reader's language. */
  category: (chave: string | null | undefined) => string
  save: (change: Change) => Promise<void>
}

/**
 * O que pode ser mudado de dentro do app. `chaves` sai do molde por um reason:
 * aqui ela load o segredo a ser gravado, enquanto no `Settings` que volta da
 * API it carries only the state — the value never makes the trip back.
 */
export type Change = Omit<Partial<Settings>, 'keys' | 'languages'> & {
  keys?: Partial<Record<'jev' | 'openai', string>>
}

const LanguageContext = createContext<Context | null>(null)

const REMEMBERED = 'hippocampus.language'

function initial(): Language {
  const saved = localStorage.getItem(REMEMBERED)
  if (saved && saved in LANGUAGES) return saved as Language
  // Before the first answer arrives, the system's own language is the least
  // wrong guess: someone who opens the app in German does not want Portuguese.
  const fromSystem = navigator.language ?? 'en-US'
  const family = fromSystem.split('-')[0]
  return (Object.keys(LANGUAGES).find((i) => i.startsWith(family)) ?? 'en-US') as Language
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setIdioma] = useState<Language>(initial)
  const [settings, setAjustes] = useState<Settings | null>(null)

  const adopt = useCallback((novos: Settings) => {
    setAjustes(novos)
    setIdioma(novos.language)
    setDayStartHour(novos.dayStartHour)
    localStorage.setItem(REMEMBERED, novos.language)
  }, [])

  useEffect(() => { api.settings().then(adopt).catch(() => {}) }, [adopt])

  // During render, not in an effect: an effect runs after the children have
  // already drawn, and the first screen came out with an English date under
  // Portuguese text. Setting it here is what keeps the two in agreement.
  setLocale(LANGUAGES[language].intl)

  const save = useCallback(async (change: Change) => {
    adopt(await api.saveSettings(change))
  }, [adopt])

  const value = useMemo<Context>(() => ({
    language,
    t: STRINGS[language],
    settings,
    category: (chave) => CATEGORY_NAMES[language][chave ?? 'unlabelled'] ?? chave ?? '',
    save,
  }), [language, settings, save])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage(): Context {
  const audioContext = useContext(LanguageContext)
  if (!audioContext) throw new Error('useLanguage fora do LanguageProvider')
  return audioContext
}

/** A shortcut for whoever only wants the strings. */
export function useStrings(): Strings {
  return useLanguage().t
}
