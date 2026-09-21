import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parse, inline, type Span } from '../src/lib/markdown.ts'

/**
 * What the model writes back, read.
 *
 * With the wider tools on, answers arrive carrying links and tables — the
 * shape of a web result — and an answer that prints its own syntax is an
 * answer nobody reads. These failures are silent: nothing throws, the text
 * just comes out as machinery.
 */

const kinds = (spans: Span[]) => spans.map((s) => s.kind)
const text = (spans: Span[]) => spans.map((s) => s.text).join('')

test('a link becomes a link', () => {
  const spans = inline('See [the changelog](https://example.com/notes) for the rest.')
  const link = spans.find((s) => s.kind === 'link')
  assert.ok(link, 'there should be a link')
  assert.equal(link.kind === 'link' && link.href, 'https://example.com/notes')
  assert.equal(link.text, 'the changelog')
  assert.doesNotMatch(text(spans), /\]\(/, 'the raw markdown must be gone')
})

test('a bare address is a link too, with or without its brackets', () => {
  for (const line of ['Fonte: https://example.com/a', 'Fonte: <https://example.com/a>']) {
    const link = inline(line).find((s) => s.kind === 'link')
    assert.ok(link && link.kind === 'link' && link.href === 'https://example.com/a', line)
  }
})

test('anything that is not http or mailto stays as text', () => {
  // These open in the person's real browser, so the scheme is not the model's
  // to choose.
  const spans = inline('[go](javascript:alert(1)) and [f](file:///etc/passwd)')
  assert.ok(!kinds(spans).includes('link'), 'no link should survive')
  assert.doesNotMatch(text(spans), /javascript:/)
  assert.match(text(spans), /go/)
})

test('a table becomes a table', () => {
  const [block] = parse([
    '| App | Minutes |',
    '| --- | ------: |',
    '| Terminal | 128 |',
    '| Chrome | 74 |',
  ].join('\n'))
  assert.equal(block.kind, 'table')
  if (block.kind !== 'table') return
  assert.deepEqual(block.head.map(text), ['App', 'Minutes'])
  assert.equal(block.rows.length, 2)
  assert.deepEqual(block.rows[0].map(text), ['Terminal', '128'])
  assert.deepEqual(block.rows[1].map(text), ['Chrome', '74'])
})

test('a table ends where its rows end', () => {
  const blocks = parse([
    '| A | B |',
    '| - | - |',
    '| 1 | 2 |',
    '',
    'and a sentence after it.',
  ].join('\n'))
  assert.equal(blocks.length, 2)
  assert.equal(blocks[0].kind, 'table')
  assert.equal(blocks[1].kind, 'paragraph')
})

test('a numbered list keeps its order, a bulleted one stays bulleted', () => {
  const [numbered] = parse('1. first\n2. second')
  assert.equal(numbered.kind, 'numbers')
  assert.equal(numbered.kind === 'numbers' && numbered.items.length, 2)

  const [bulleted] = parse('- one\n- two')
  assert.equal(bulleted.kind, 'bullets')
})

test('a fenced block keeps its lines and its spacing', () => {
  const [block] = parse('```sh\nls -la\n  cd /tmp\n```')
  assert.equal(block.kind, 'code')
  assert.equal(block.kind === 'code' && block.text, 'ls -la\n  cd /tmp')
})

test('a block left unclosed does not eat the rest of the answer', () => {
  // The answer can be cut off mid-block, and when it is, what came before must
  // still be there rather than vanishing into a fence with no end.
  const blocks = parse('before\n```\nstill inside')
  assert.equal(blocks[0].kind, 'paragraph')
  assert.equal(blocks[1].kind, 'code')
})

test('emphasis and code survive inside a table cell', () => {
  const [block] = parse('| A | B |\n| - | - |\n| **bold** | `code` |')
  assert.equal(block.kind, 'table')
  if (block.kind !== 'table') return
  assert.deepEqual(block.rows[0].map(kinds), [['strong'], ['code']])
})

test('plain prose comes out as paragraphs, unchanged', () => {
  const blocks = parse('Hoje você ficou mais tempo no editor.\n\nE ontem, no navegador.')
  assert.equal(blocks.length, 2)
  assert.ok(blocks.every((b) => b.kind === 'paragraph'))
  assert.equal(text((blocks[0] as any).spans), 'Hoje você ficou mais tempo no editor.')
})
