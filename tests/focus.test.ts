import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// The database is opened on import, from config.dataDir. Pointing that at a
// temporary folder BEFORE importing is what keeps the test away from the real
// data of whoever is running it.
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'hippocampus-test-'))
process.env.HIPPOCAMPUS_DATA = temporary

const { FocusCollector } = await import('../core/sources/focus.ts')
const { db } = await import('../core/db.ts')

after(() => fs.rmSync(temporary, { recursive: true, force: true }))

/** A sample as the native helper delivers it, with everything filled in. */
function sample(extra: Record<string, unknown> = {}) {
  return {
    ts: new Date().toISOString(),
    idle: 0, locked: false, trusted: true,
    keys: 100, clicks: 10, scroll: 5,
    mic: true, sound: true, listening: false,
    mediaOpen: 'Music', playing: 'Miles Davis — So What',
    screen: 'GP27-FQS',
    app: 'Code', bundle: 'com.microsoft.VSCode', title: 'focus.ts',
    ...extra,
  }
}

test('every value has a column: the insert stores everything the helper reports', () => {
  const collector = new FocusCollector()
  // `push` swallows the error and only logs it — in a test that would hide the
  // very failure being looked for.
  let failed: unknown
  const originalError = console.error
  console.error = (...args: unknown[]) => { failed = args }
  collector.push(sample())
  console.error = originalError
  assert.equal(failed, undefined, `ingestion failed: ${String(failed)}`)

  const block = db.prepare('select * from blocks order by id desc limit 1').get() as any
  assert.ok(block, 'no block was written')

  // This is the assertion that would have caught the bug: the insert declared
  // 14 columns and received 18 values, and the last four — screen, sound,
  // media, playing — never reached the database. 887 blocks went in with those
  // fields empty.
  assert.equal(block.app, 'Code')
  assert.equal(block.screen, 'GP27-FQS')
  assert.equal(block.sound, 1)
  assert.equal(block.mic, 1)
  assert.equal(block.playing, 'Miles Davis — So What')
  assert.equal(block.media, 'Music')
})

test('the same window continues the same block, and known sound survives', () => {
  const collector = new FocusCollector()
  collector.push(sample({ ts: new Date(Date.now() - 4000).toISOString() }))
  const id = (db.prepare('select id from blocks order by id desc limit 1').get() as any).id

  // Same window, same track, four seconds later: the block is extended. This
  // sample carries no sound — and that cannot erase what was already known,
  // because a block with sound is a block with sound, not an instant of silence.
  collector.push(sample({ sound: false, keys: 150 }))
  const after = db.prepare('select * from blocks where id = ?').get(id) as any

  assert.equal((db.prepare('select count(*) n from blocks where id > ?').get(id) as any).n, 0,
    'the second sample created a new block instead of extending the open one')
  assert.equal(after.sound, 1, 'sound already recorded was erased by a sample without it')
  assert.equal(after.keys, 50, 'the key delta between samples was not added up')
})

test('changing track starts a new block', () => {
  // The track is part of the block's identity on purpose: "forty minutes
  // listening to this" is only a true sentence if a change splits the stretches.
  const collector = new FocusCollector()
  collector.push(sample({ ts: new Date(Date.now() + 120_000).toISOString() }))
  const id = (db.prepare('select id from blocks order by id desc limit 1').get() as any).id

  collector.push(sample({
    ts: new Date(Date.now() + 124_000).toISOString(),
    playing: 'John Coltrane — Naima',
  }))
  const fresh = db.prepare('select * from blocks order by id desc limit 1').get() as any
  assert.notEqual(fresh.id, id, 'the track changed and the block stayed the same')
  assert.equal(fresh.playing, 'John Coltrane — Naima')
})

test('a secret window keeps neither title nor address', () => {
  const collector = new FocusCollector()
  collector.push(sample({
    app: '1Password', title: 'Personal vault', url: 'https://bank.example/account',
    ts: new Date(Date.now() + 60_000).toISOString(),
  }))
  const block = db.prepare('select * from blocks order by id desc limit 1').get() as any
  assert.equal(block.app, '1Password', 'the app itself may be recorded')
  assert.equal(block.title, null, 'the title of a secret window leaked')
  assert.equal(block.url, null, 'the address of a secret window leaked')
})
