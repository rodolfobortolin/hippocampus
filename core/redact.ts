/** Strips secrets out of any text before storing it or sending it to a model. */
const patterns: [RegExp, string][] = [
  // A private key pasted whole — a .p8 for Apple, a PEM for a server. First,
  // before anything else can cut it into pieces; and a block that lost its
  // END line to a cut still goes, up to where the base64 stops.
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, '«private key»'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[A-Za-z0-9+/=\s]*/g, '«private key»'],
  // Stripe writes its keys with underscores, which the pattern below — made
  // for OpenAI's and Anthropic's hyphens — never matched: a secret test key
  // pasted into a request was stored as it was typed.
  [/\b(sk|rk|pk)_(live|test)_[A-Za-z0-9]{16,}/g, '«key»'],
  [/\bwhsec_[A-Za-z0-9]{16,}/g, '«key»'],
  [/\b(sk|pk|rk)-[A-Za-z0-9_-]{16,}/g, '«key»'],
  [/\bapikey_[A-Za-z0-9_]{16,}/g, '«key»'],
  [/\b(ghp|gho|ghu|ghs|ghr|github_pat)_[A-Za-z0-9_]{16,}/g, '«token»'],
  [/\bxox[baprs]-[A-Za-z0-9-]{10,}/g, '«token»'],
  [/\bey[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{6,}/g, '«jwt»'],
  [/\bAKIA[0-9A-Z]{16}\b/g, '«aws»'],
  [/\bBearer\s+[A-Za-z0-9._~+/-]{16,}=*/gi, 'Bearer «token»'],
  [/\b(pass(word)?|senha|secret|token|api[_-]?key|authorization)\s*[:=]\s*\S+/gi, '$1=«hidden»'],
  [/\b(?:\d[ -]*?){13,19}\b/g, '«card»'],
  [/\b[0-9a-f]{40,}\b/gi, '«hash»'],
]

export function redact(text: string | null | undefined): string {
  if (!text) return ''
  let out = text
  for (const [pattern, replacement] of patterns) out = out.replace(pattern, replacement)
  return out
}
