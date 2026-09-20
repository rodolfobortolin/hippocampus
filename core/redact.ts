/** Tira segredos de qualquer texto antes de guardar ou mandar para um modelo. */
const patterns: [RegExp, string][] = [
  [/\b(sk|pk|rk)-[A-Za-z0-9_-]{16,}/g, '«chave»'],
  [/\bapikey_[A-Za-z0-9_]{16,}/g, '«chave»'],
  [/\b(ghp|gho|ghu|ghs|ghr|github_pat)_[A-Za-z0-9_]{16,}/g, '«token»'],
  [/\bxox[baprs]-[A-Za-z0-9-]{10,}/g, '«token»'],
  [/\bey[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{6,}/g, '«jwt»'],
  [/\bAKIA[0-9A-Z]{16}\b/g, '«aws»'],
  [/\bBearer\s+[A-Za-z0-9._~+/-]{16,}=*/gi, 'Bearer «token»'],
  [/\b(pass(word)?|senha|secret|token|api[_-]?key|authorization)\s*[:=]\s*\S+/gi, '$1=«oculto»'],
  [/\b(?:\d[ -]*?){13,19}\b/g, '«cartão»'],
  [/\b[0-9a-f]{40,}\b/gi, '«hash»'],
]

export function redact(text: string | null | undefined): string {
  if (!text) return ''
  let out = text
  for (const [pattern, replacement] of patterns) out = out.replace(pattern, replacement)
  return out
}
