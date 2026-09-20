// The key names the system hands over are raw ("up_arrow", "functionright_arrow").
// Here they become the symbol that shows up in a macOS menu.
const SYMBOLS: Record<string, string> = {
  up_arrow: '↑', down_arrow: '↓', left_arrow: '←', right_arrow: '→',
  return: '↵', enter: '↵', delete: '⌫', forward_delete: '⌦', escape: '⎋',
  tab: '⇥', space: '␣', home: '↖', end: '↘', page_up: '⇞', page_down: '⇟',
}

const MODIFIERS: Record<string, string> = {
  command: '⌘', cmd: '⌘', shift: '⇧', option: '⌥', alt: '⌥',
  control: '⌃', ctrl: '⌃', function: 'fn', fn: 'fn',
}

/** "functionup_arrow" → "fn↑"; "return" → "↵"; "v" → "v". */
export function prettyKey(raw: string): string {
  let key = String(raw ?? '').trim().toLowerCase()
  if (!key) return ''
  let prefix = ''
  // Algumas teclas chegam com o modificador colado no name.
  for (const [name, simbolo] of Object.entries(MODIFIERS)) {
    if (key.startsWith(name) && key.length > name.length) {
      prefix = simbolo
      key = key.slice(name.length)
      break
    }
  }
  return prefix + (SYMBOLS[key] ?? (key.length === 1 ? key : key.replace(/_/g, ' ')))
}

export function shortcutLabel(keyboard: any): string {
  const modifiers: string[] = (keyboard?.modifiers ?? [])
    .map((m: string) => MODIFIERS[String(m).toLowerCase()] ?? m)
  const key = prettyKey(keyboard?.keyEquivalent ?? keyboard?.key ?? '')
  if (!key) return '' // a modifier on its own is not a shortcut
  return modifiers.join('') + key
}

export function hasModifier(keyboard: any): boolean {
  return Array.isArray(keyboard?.modifiers) && keyboard.modifiers.length > 0
}
