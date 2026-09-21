import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

process.env.HIPPOCAMPUS_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'hippocampus-stream-'))

const { streamedText } = await import('../core/agent.ts')

/**
 * The chat writes the answer as it streams, block by block. A turn that calls
 * a tool has two blocks of text — the note before the lookup and the answer
 * after it — and joined as they came they read as one run-on sentence.
 */

const start = (type: string) => ({ type: 'content_block_start', content_block: { type } })
const text = (piece: string) => ({ type: 'content_block_delta', delta: { type: 'text_delta', text: piece } })

function stream(events: object[]): string {
  let streamed = false
  let screen = ''
  for (const event of events) {
    const piece = streamedText(event, streamed)
    streamed ||= piece.trim() !== ''
    screen += piece
  }
  return screen
}

test('the answer after a tool starts a paragraph of its own', () => {
  const screen = stream([
    start('text'), text("I'll pull the measured week."),
    start('tool_use'), { type: 'content_block_delta', delta: { type: 'input_json_delta', partial_json: '{}' } },
    start('text'), text('Mon 14 → today, 46h55 active.'),
  ])
  assert.equal(screen, "I'll pull the measured week.\n\nMon 14 → today, 46h55 active.")
})

test('an answer that opens with no note has nothing in front of it', () => {
  const screen = stream([start('tool_use'), start('text'), text('Six hours.')])
  assert.equal(screen, 'Six hours.')
})

test('pieces of one block are joined exactly as they came', () => {
  assert.equal(stream([start('text'), text('Six '), text('hours.')]), 'Six hours.')
})
