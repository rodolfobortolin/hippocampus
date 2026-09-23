import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

process.env.HIPPOCAMPUS_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'hippocampus-live-'))

const { LiveVoice } = await import('../core/live.ts')

/**
 * The live session closes itself after ten seconds with nobody talking — but
 * not while Claude Code is still working on an answer, when the room is quiet
 * by design.
 */

function session() {
  const closed: string[] = []
  const voice = new LiveVoice({
    onRequest: () => {}, onSpoken: () => {}, onHeard: () => {}, onCaption: () => {},
    onClosed: (reason) => closed.push(reason), onError: () => {},
  })
  // A socket stand-in: answer() sends on it, and close() closes it.
  ;(voice as any).ws = { send() {}, close() {} }
  return { voice: voice as any, closed }
}

test('ten quiet seconds close the session', () => {
  mock.timers.enable({ apis: ['setTimeout'] })
  try {
    const { voice, closed } = session()
    voice.touch()
    mock.timers.tick(9_900)
    assert.deepEqual(closed, [])
    mock.timers.tick(200)
    assert.deepEqual(closed, ['silence'])
  } finally {
    mock.timers.reset()
  }
})

test('a question being answered holds the session open, and the answer restarts the count', () => {
  mock.timers.enable({ apis: ['setTimeout'] })
  try {
    const { voice, closed } = session()
    voice.delegation = 'd-1'
    voice.touch()
    mock.timers.tick(60_000)
    assert.deepEqual(closed, [], 'still working after a minute')
    voice.answer('Six hours.')
    mock.timers.tick(9_900)
    assert.deepEqual(closed, [])
    mock.timers.tick(200)
    assert.deepEqual(closed, ['silence'])
  } finally {
    mock.timers.reset()
  }
})
