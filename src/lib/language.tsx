import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { LANGUAGES, STRINGS, type Language, type Strings } from './strings.ts'
import { CATEGORY_NAMES } from '../../core/languages.ts'
import { api, type Settings } from './api.ts'
import { setDayStartHour, setLocale } from './format.ts'

/**
 * O language escolhido, disponível para a canvas inteira.
 *
 * O núcleo é quem store a escolha — é ele que escreve o diário e conversa, e
 * os dois precisam concordar. A canvas question uma vez ao subir e store uma
 * cópia no navegador só para não piscar em português antes da answer chegar.
 */
type Context = {
  language: Language
  t: Strings
  settings: Settings | null
  /** O name de uma category na língua de quem lê. */
  category: (chave: string | null | undefined) => string
  save: (change: Change) => Promise<void>
}

/**
 * O que pode ser mudado de dentro do app. `chaves` sai do molde por um reason:
 * aqui ela load o segredo a ser gravado, enquanto no `Settings` que volta da
 * API ela load só o state — o value nunca faz o caminho de volta.
 */
export type Change = Omit<Partial<Settings>, 'keys' | 'languages'> & {
  keys?: Partial<Record<'jev' | 'openai', string>>
}

const LanguageContext = createContext<Context | null>(null)

const REMEMBERED = 'hippocampus.language'

function initial(): Language {
  const saved = localStorage.getItem(REMEMBERED)
  if (saved && saved in LANGUAGES) return saved as Language
  // Antes de a primeira answer chegar, o language do próprio sistema é o
  // palpite menos errado: quem abre o app em alemão não quer ver português.
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

  // Durante a renderização, e não num efeito: efeito roda depois que os filhos
  // já desenharam, e a primeira canvas saía com a data em inglês debaixo de um
  // text em português. Definir aqui é o que faz os dois combinarem sempre.
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

/** Atalho para quem só quer os textos. */
export function useStrings(): Strings {
  return useLanguage().t
}
