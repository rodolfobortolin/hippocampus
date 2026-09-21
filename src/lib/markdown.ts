/**
 * Enough markdown for what the model actually writes back.
 *
 * This half is the reading: text in, a small tree out, no React anywhere near
 * it — which is what makes it testable, and it is worth testing, because the
 * failures here are silent. A renderer that misses a rule does not throw; it
 * prints the syntax and the answer reads like machinery.
 *
 * It is not a full parser and does not try to be. It covers what shows up in
 * answers — emphasis, code, lists, headings, links, tables, quotes — and
 * anything it does not know falls through as the text it already was.
 */

export type Span =
  | { kind: 'text'; text: string }
  | { kind: 'strong'; text: string }
  | { kind: 'em'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'link'; text: string; href: string }

export type Block =
  | { kind: 'paragraph'; spans: Span[] }
  | { kind: 'heading'; spans: Span[] }
  | { kind: 'quote'; spans: Span[] }
  | { kind: 'bullets'; items: Span[][] }
  | { kind: 'numbers'; items: Span[][] }
  | { kind: 'code'; text: string }
  | { kind: 'table'; head: Span[][]; rows: Span[][][] }

/**
 * A link we are willing to open, which is a browser's worth of them and no
 * more. The scheme is not the model's to choose: this opens in the person's
 * real browser, so `javascript:` and `file:` stay text.
 */
function safeHref(url: string): string | null {
  return /^(https?:|mailto:)/i.test(url.trim()) ? url.trim() : null
}

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*|\[[^\]]+\]\([^)\s]+\)|<?https?:\/\/[^\s<>()]+>?)/g

/** Emphasis, code and links inside one line. */
export function inline(text: string): Span[] {
  const spans: Span[] = []
  let last = 0
  let found: RegExpExecArray | null
  INLINE.lastIndex = 0

  const plain = (piece: string) => {
    if (piece) spans.push({ kind: 'text', text: piece })
  }

  while ((found = INLINE.exec(text))) {
    plain(text.slice(last, found.index))
    const raw = found[0]

    const marked = raw.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/)
    if (marked) {
      const href = safeHref(marked[2])
      if (href) spans.push({ kind: 'link', text: marked[1], href })
      else plain(marked[1])
    } else if (raw.startsWith('**')) {
      spans.push({ kind: 'strong', text: raw.slice(2, -2) })
    } else if (raw.startsWith('`')) {
      spans.push({ kind: 'code', text: raw.slice(1, -1) })
    } else if (raw.startsWith('*')) {
      spans.push({ kind: 'em', text: raw.slice(1, -1) })
    } else {
      // A bare address, with the angle brackets some models wrap them in.
      const bare = raw.replace(/^<|>$/g, '')
      const href = safeHref(bare)
      if (href) spans.push({ kind: 'link', text: bare, href })
      else plain(bare)
    }
    last = found.index + raw.length
  }
  plain(text.slice(last))
  return spans
}

const cells = (row: string) =>
  row.trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim())

/** The `|---|:--:|` line that makes the row above it a header. */
const isRule = (row: string) =>
  /^\|?[\s:|-]+\|[\s:|-]*$/.test(row.trim()) && row.includes('-')

export function parse(text: string): Block[] {
  const blocks: Block[] = []
  let bullets: Span[][] = []
  let numbers: Span[][] = []

  const closeLists = () => {
    if (bullets.length) { blocks.push({ kind: 'bullets', items: bullets }); bullets = [] }
    if (numbers.length) { blocks.push({ kind: 'numbers', items: numbers }); numbers = [] }
  }

  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const clear = lines[i].trim()
    if (!clear) { closeLists(); continue }

    // A fenced block runs to its closing fence, or to the end if the answer was
    // cut off mid-block — which happens, and must not swallow the rest.
    if (clear.startsWith('```')) {
      const body: string[] = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith('```')) body.push(lines[i++])
      closeLists()
      blocks.push({ kind: 'code', text: body.join('\n') })
      continue
    }

    // A table: a row of pipes, the rule under it, then rows until they stop.
    if (clear.includes('|') && isRule(lines[i + 1] ?? '')) {
      const head = cells(clear).map(inline)
      const rows: Span[][][] = []
      i += 2
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
        rows.push(cells(lines[i]).map(inline))
        i++
      }
      i--
      closeLists()
      blocks.push({ kind: 'table', head, rows })
      continue
    }

    if (/^[-*•]\s+/.test(clear)) {
      bullets.push(inline(clear.replace(/^[-*•]\s+/, '')))
      continue
    }
    if (/^\d+[.)]\s+/.test(clear)) {
      numbers.push(inline(clear.replace(/^\d+[.)]\s+/, '')))
      continue
    }

    closeLists()
    if (/^#{1,6}\s/.test(clear)) {
      blocks.push({ kind: 'heading', spans: inline(clear.replace(/^#{1,6}\s/, '')) })
      continue
    }
    if (/^>\s?/.test(clear)) {
      blocks.push({ kind: 'quote', spans: inline(clear.replace(/^>\s?/, '')) })
      continue
    }
    blocks.push({ kind: 'paragraph', spans: inline(clear) })
  }
  closeLists()
  return blocks
}
