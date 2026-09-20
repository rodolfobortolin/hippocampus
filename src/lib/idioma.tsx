import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { LANGUAGES, TEXTOS, type Language, type Textos } from './textos.ts'
import { CATEGORY_NAMES } from '../../core/languages.ts'
import { api, type Settings } from './api.ts'
import { defineInicioDoDia, defineLocale } from './format.ts'

/**
 * O idioma escolhido, disponível para a tela inteira.
 *
 * O núcleo é quem guarda a escolha — é ele que escreve o diário e conversa, e
 * os dois precisam concordar. A tela pergunta uma vez ao subir e guarda uma
 * cópia no navegador só para não piscar em português antes da resposta chegar.
 */
type Contexto = {
  idioma: Language
  t: Textos
  ajustes: Settings | null
  /** O nome de uma categoria na língua de quem lê. */
  categoria: (chave: string | null | undefined) => string
  salva: (mudanca: Mudanca) => Promise<void>
}

/**
 * O que pode ser mudado de dentro do app. `chaves` sai do molde por um motivo:
 * aqui ela carrega o segredo a ser gravado, enquanto no `Settings` que volta da
 * API ela carrega só o estado — o valor nunca faz o caminho de volta.
 */
export type Mudanca = Omit<Partial<Settings>, 'chaves' | 'idiomas'> & {
  chaves?: Partial<Record<'jev' | 'openai', string>>
}

const IdiomaContexto = createContext<Contexto | null>(null)

const LEMBRADO = 'hipocampo.idioma'

function inicial(): Language {
  const salvo = localStorage.getItem(LEMBRADO)
  if (salvo && salvo in LANGUAGES) return salvo as Language
  // Antes de a primeira resposta chegar, o idioma do próprio sistema é o
  // palpite menos errado: quem abre o app em alemão não quer ver português.
  const doSistema = navigator.language ?? 'en-US'
  const familia = doSistema.split('-')[0]
  return (Object.keys(LANGUAGES).find((i) => i.startsWith(familia)) ?? 'en-US') as Language
}

export function ProvedorDeIdioma({ children }: { children: ReactNode }) {
  const [idioma, setIdioma] = useState<Language>(inicial)
  const [ajustes, setAjustes] = useState<Settings | null>(null)

  const adota = useCallback((novos: Settings) => {
    setAjustes(novos)
    setIdioma(novos.idioma)
    defineInicioDoDia(novos.inicioDoDia)
    localStorage.setItem(LEMBRADO, novos.idioma)
  }, [])

  useEffect(() => { api.ajustes().then(adota).catch(() => {}) }, [adota])

  // Durante a renderização, e não num efeito: efeito roda depois que os filhos
  // já desenharam, e a primeira tela saía com a data em inglês debaixo de um
  // texto em português. Definir aqui é o que faz os dois combinarem sempre.
  defineLocale(LANGUAGES[idioma].intl)

  const salva = useCallback(async (mudanca: Mudanca) => {
    adota(await api.saveSettings(mudanca))
  }, [adota])

  const valor = useMemo<Contexto>(() => ({
    idioma,
    t: TEXTOS[idioma],
    ajustes,
    categoria: (chave) => CATEGORY_NAMES[idioma][chave ?? 'unlabelled'] ?? chave ?? '',
    salva,
  }), [idioma, ajustes, salva])

  return <IdiomaContexto.Provider value={valor}>{children}</IdiomaContexto.Provider>
}

export function useIdioma(): Contexto {
  const contexto = useContext(IdiomaContexto)
  if (!contexto) throw new Error('useIdioma fora do ProvedorDeIdioma')
  return contexto
}

/** Atalho para quem só quer os textos. */
export function useTextos(): Textos {
  return useIdioma().t
}
