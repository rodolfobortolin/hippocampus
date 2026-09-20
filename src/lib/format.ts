export const COLOURS: Record<string, string> = {
  code: 'var(--code)', ai: 'var(--ai)', research: 'var(--research)',
  communication: 'var(--communication)', writing: 'var(--writing)', design: 'var(--design)',
  admin: 'var(--admin)', distraction: 'var(--distraction)', 'unlabelled': 'var(--unlabelled)',
}

/**
 * O language das datas e dos números.
 *
 * Fica num módulo em vez de descer por propriedade porque data aparece em toda
 * parte da canvas, e passar o locale por trinta camadas só para formatar "sábado"
 * é ruído sem retorno. O provedor de language define isto uma vez.
 */
let locale = 'pt-BR'
export function setLocale(novo: string): void {
  locale = novo
}

export const colour = (category: string | null | undefined) =>
  COLOURS[category ?? 'unlabelled'] ?? 'var(--unlabelled)'

/** 2h07, 48min, 35s — a unit muda com a grandeza. */
export function duration(seconds: number): string {
  if (!seconds || seconds < 0) return '0min'
  if (seconds < 60) return `${Math.round(seconds)}s`
  if (seconds < 3600) return `${Math.round(seconds / 60)}min`
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.round((seconds % 3600) / 60)
  return minutes ? `${hours}h${String(minutes).padStart(2, '0')}` : `${hours}h`
}

export function hours(seconds: number): { value: string; unit: string } {
  if (seconds < 3600) return { value: String(Math.round(seconds / 60)), unit: 'min' }
  return { value: (seconds / 3600).toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }), unit: 'h' }
}

/** Um número com o separador de milhar do language. */
export const number = (value: number): string => value.toLocaleString(locale)

/** Os names curtos dos days da semana, na língua de quem lê. */
export function weekdayNames(): string[] {
  // 4 de janeiro de 1970 foi um domingo — é a âncora para a semana begin nele.
  // O fuso tem que ser UTC também na formatação: sem isso, num fuso a oeste a
  // meia-noite UTC cai no day anterior e a semana inteira sai deslocada — a
  // linha do domingo aparecia rotulada como sábado.
  const formatter = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' })
  return Array.from({ length: 7 }, (_, i) => formatter.format(new Date(Date.UTC(1970, 0, 4 + i))).replace('.', ''))
}

export const clock = (ts: number | null | undefined) =>
  ts ? new Date(ts * 1000).toTimeString().slice(0, 5) : '—'

export function longDate(day: string): string {
  const [year, month, d] = day.split('-').map(Number)
  const text = new Date(year, month - 1, d).toLocaleDateString(locale, {
    weekday: 'long', day: 'numeric', month: 'long',
  })
  // Só a primeira letra sobe: "Sábado, 19 de setembro", não "19 De Setembro".
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function shortDate(day: string): string {
  const [year, month, d] = day.split('-').map(Number)
  return new Date(year, month - 1, d).toLocaleDateString(locale, { day: '2-digit', month: 'short' })
}

/** A hour em que o day vira, espelhada do núcleo pelo /api/settings. */
let dayStartHour = 4
export function setDayStartHour(hour: number): void {
  dayStartHour = hour
}

export function today(): string {
  const now = new Date()
  const shifted = new Date(now.getTime() - dayStartHour * 3600_000)
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, '0')}-${String(shifted.getDate()).padStart(2, '0')}`
}

export function addDays(day: string, delta: number): string {
  const [year, month, d] = day.split('-').map(Number)
  const data = new Date(year, month - 1, d + delta)
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`
}

/** Corta a cauda long: mantém os maiores e sum o rest em "outros". */
export function topSlices<T extends { name: string; seconds: number }>(
  items: T[], max = 9, minimum = 25,
): { name: string; seconds: number }[] {
  const relevant = items.filter((item) => item.seconds >= minimum)
  const top = relevant.slice(0, max)
  const rest = [...relevant.slice(max), ...items.filter((item) => item.seconds < minimum)]
  const leftover = rest.reduce((sum, item) => sum + item.seconds, 0)
  return leftover >= minimum ? [...top, { name: `__outros__${rest.length}`, seconds: leftover }] : top
}

/** "1 sessão" / "3 sessões" — o par vem do dicionário do language. */
export const plural = (n: number, par: readonly [string, string]) => `${number(n)} ${n === 1 ? par[0] : par[1]}`

/** Velocidade da speech das respostas. A voz sintética lê devagar para quem já
 *  conhece o assunto; 1,5× é o ponto em que ainda dá para acompanhar. */
export const SPEECH_RATE = Number(localStorage.getItem('hipocampo.velocidade') ?? 1.5)
