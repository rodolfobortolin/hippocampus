export const CORES: Record<string, string> = {
  codigo: 'var(--codigo)', ia: 'var(--ia)', pesquisa: 'var(--pesquisa)',
  comunicacao: 'var(--comunicacao)', escrita: 'var(--escrita)', design: 'var(--design)',
  admin: 'var(--admin)', distracao: 'var(--distracao)', 'sem rótulo': 'var(--sem-rotulo)',
}

/**
 * O idioma das datas e dos números.
 *
 * Fica num módulo em vez de descer por propriedade porque data aparece em toda
 * parte da tela, e passar o locale por trinta camadas só para formatar "sábado"
 * é ruído sem retorno. O provedor de idioma define isto uma vez.
 */
let locale = 'pt-BR'
export function defineLocale(novo: string): void {
  locale = novo
}

export const cor = (categoria: string | null | undefined) =>
  CORES[categoria ?? 'sem rótulo'] ?? 'var(--sem-rotulo)'

/** 2h07, 48min, 35s — a unidade muda com a grandeza. */
export function duracao(segundos: number): string {
  if (!segundos || segundos < 0) return '0min'
  if (segundos < 60) return `${Math.round(segundos)}s`
  if (segundos < 3600) return `${Math.round(segundos / 60)}min`
  const horas = Math.floor(segundos / 3600)
  const minutos = Math.round((segundos % 3600) / 60)
  return minutos ? `${horas}h${String(minutos).padStart(2, '0')}` : `${horas}h`
}

export function horas(segundos: number): { valor: string; unidade: string } {
  if (segundos < 3600) return { valor: String(Math.round(segundos / 60)), unidade: 'min' }
  return { valor: (segundos / 3600).toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }), unidade: 'h' }
}

/** Um número com o separador de milhar do idioma. */
export const numero = (valor: number): string => valor.toLocaleString(locale)

/** Os nomes curtos dos dias da semana, na língua de quem lê. */
export function diasDaSemana(): string[] {
  // 4 de janeiro de 1970 foi um domingo — é a âncora para a semana começar nele.
  // O fuso tem que ser UTC também na formatação: sem isso, num fuso a oeste a
  // meia-noite UTC cai no dia anterior e a semana inteira sai deslocada — a
  // linha do domingo aparecia rotulada como sábado.
  const formato = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' })
  return Array.from({ length: 7 }, (_, i) => formato.format(new Date(Date.UTC(1970, 0, 4 + i))).replace('.', ''))
}

export const relogio = (ts: number | null | undefined) =>
  ts ? new Date(ts * 1000).toTimeString().slice(0, 5) : '—'

export function dataLonga(dia: string): string {
  const [ano, mes, d] = dia.split('-').map(Number)
  const texto = new Date(ano, mes - 1, d).toLocaleDateString(locale, {
    weekday: 'long', day: 'numeric', month: 'long',
  })
  // Só a primeira letra sobe: "Sábado, 19 de setembro", não "19 De Setembro".
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

export function dataCurta(dia: string): string {
  const [ano, mes, d] = dia.split('-').map(Number)
  return new Date(ano, mes - 1, d).toLocaleDateString(locale, { day: '2-digit', month: 'short' })
}

/** A hora em que o dia vira, espelhada do núcleo pelo /api/ajustes. */
let inicioDoDia = 4
export function defineInicioDoDia(hora: number): void {
  inicioDoDia = hora
}

export function hoje(): string {
  const agora = new Date()
  const deslocado = new Date(agora.getTime() - inicioDoDia * 3600_000)
  return `${deslocado.getFullYear()}-${String(deslocado.getMonth() + 1).padStart(2, '0')}-${String(deslocado.getDate()).padStart(2, '0')}`
}

export function somaDias(dia: string, delta: number): string {
  const [ano, mes, d] = dia.split('-').map(Number)
  const data = new Date(ano, mes - 1, d + delta)
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`
}

/** Corta a cauda longa: mantém os maiores e soma o resto em "outros". */
export function principais<T extends { name: string; seconds: number }>(
  itens: T[], max = 9, minimo = 25,
): { name: string; seconds: number }[] {
  const relevantes = itens.filter((item) => item.seconds >= minimo)
  const topo = relevantes.slice(0, max)
  const resto = [...relevantes.slice(max), ...itens.filter((item) => item.seconds < minimo)]
  const sobra = resto.reduce((soma, item) => soma + item.seconds, 0)
  return sobra >= minimo ? [...topo, { name: `__outros__${resto.length}`, seconds: sobra }] : topo
}

/** "1 sessão" / "3 sessões" — o par vem do dicionário do idioma. */
export const plural = (n: number, par: readonly [string, string]) => `${numero(n)} ${n === 1 ? par[0] : par[1]}`

/** Velocidade da fala das respostas. A voz sintética lê devagar para quem já
 *  conhece o assunto; 1,5× é o ponto em que ainda dá para acompanhar. */
export const VELOCIDADE_DA_FALA = Number(localStorage.getItem('hipocampo.velocidade') ?? 1.5)
