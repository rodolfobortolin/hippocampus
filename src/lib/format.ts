export const CORES: Record<string, string> = {
  codigo: 'var(--codigo)', ia: 'var(--ia)', pesquisa: 'var(--pesquisa)',
  comunicacao: 'var(--comunicacao)', escrita: 'var(--escrita)', design: 'var(--design)',
  admin: 'var(--admin)', distracao: 'var(--distracao)', 'sem rótulo': 'var(--sem-rotulo)',
}

export const NOMES: Record<string, string> = {
  codigo: 'código', ia: 'IA', pesquisa: 'pesquisa', comunicacao: 'comunicação',
  escrita: 'escrita', design: 'design', admin: 'admin', distracao: 'distração',
  'sem rótulo': 'sem rótulo',
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
  return { valor: (segundos / 3600).toFixed(1).replace('.', ','), unidade: 'h' }
}

export const relogio = (ts: number | null | undefined) =>
  ts ? new Date(ts * 1000).toTimeString().slice(0, 5) : '—'

export function dataLonga(dia: string): string {
  const [ano, mes, d] = dia.split('-').map(Number)
  const texto = new Date(ano, mes - 1, d).toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
  // Só a primeira letra sobe: "Sábado, 19 de setembro", não "19 De Setembro".
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

export function dataCurta(dia: string): string {
  const [ano, mes, d] = dia.split('-').map(Number)
  return new Date(ano, mes - 1, d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

export function hoje(): string {
  const agora = new Date()
  const deslocado = new Date(agora.getTime() - 4 * 3600_000)
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
  return sobra >= minimo ? [...topo, { name: `outros ${resto.length}`, seconds: sobra }] : topo
}

export const plural = (n: number, um: string, muitos: string) => `${n} ${n === 1 ? um : muitos}`
