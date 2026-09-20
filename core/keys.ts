// Os nomes de tecla que o sistema entrega são crus ("up_arrow", "functionright_arrow").
// Aqui viram o símbolo que aparece no menu do macOS.
const SIMBOLOS: Record<string, string> = {
  up_arrow: '↑', down_arrow: '↓', left_arrow: '←', right_arrow: '→',
  return: '↵', enter: '↵', delete: '⌫', forward_delete: '⌦', escape: '⎋',
  tab: '⇥', space: '␣', home: '↖', end: '↘', page_up: '⇞', page_down: '⇟',
}

const MODIFICADORES: Record<string, string> = {
  command: '⌘', cmd: '⌘', shift: '⇧', option: '⌥', alt: '⌥',
  control: '⌃', ctrl: '⌃', function: 'fn', fn: 'fn',
}

/** "functionup_arrow" → "fn↑"; "return" → "↵"; "v" → "v". */
export function prettyKey(raw: string): string {
  let key = String(raw ?? '').trim().toLowerCase()
  if (!key) return ''
  let prefixo = ''
  // Algumas teclas chegam com o modificador colado no nome.
  for (const [nome, simbolo] of Object.entries(MODIFICADORES)) {
    if (key.startsWith(nome) && key.length > nome.length) {
      prefixo = simbolo
      key = key.slice(nome.length)
      break
    }
  }
  return prefixo + (SIMBOLOS[key] ?? (key.length === 1 ? key : key.replace(/_/g, ' ')))
}

export function shortcutLabel(keyboard: any): string {
  const modificadores: string[] = (keyboard?.modifiers ?? [])
    .map((m: string) => MODIFICADORES[String(m).toLowerCase()] ?? m)
  const tecla = prettyKey(keyboard?.keyEquivalent ?? keyboard?.key ?? '')
  if (!tecla) return '' // só modificador não é atalho
  return modificadores.join('') + tecla
}

export function hasModifier(keyboard: any): boolean {
  return Array.isArray(keyboard?.modifiers) && keyboard.modifiers.length > 0
}
