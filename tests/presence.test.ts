import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// A database of its own, set before anything imports the core.
process.env.HIPPOCAMPUS_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'hippocampus-presence-'))

const { db } = await import('../core/db.ts')
const { readPresence, presenceOf } = await import('../core/sources/presence.ts')

/**
 * Lines in the shape `pmset -g log` prints them, trimmed of the columns this
 * never reads. The window server's assertion is the person; the others are
 * programs that take the same kind of assertion for their own reasons.
 */
const ws = (at: string, event: string, held: string, id = '0x0x900001') =>
  `2026-09-19 ${at} -0300 Assertions          \tPID 404(WindowServer) ${event} UserIsActive "com.apple.iohideventsystem.queue.tickle serviceID:1 product:Keyboard eventType:3" ${held}  id:${id} [System: PrevIdle kDisp]`
const other = (at: string, who: string) =>
  `2026-09-19 ${at} -0300 Assertions          \tPID 900(${who}) Created UserIsActive "interaction" 00:00:00  id:0x0x700001 [System: kDisp]`
const sleep = (at: string) =>
  `2026-09-19 ${at} -0300 Sleep               \tEntering Sleep state due to 'Clamshell Sleep':TCPKeepAlive=active Using AC 4 secs`

const at = (clock: string) => Math.floor(new Date(`2026-09-19T${clock}-03:00`).getTime() / 1000)
const read = (...lines: string[]) => readPresence(lines.join('\n'))

test('a stretch runs from the first key to the last, not to the lapse', () => {
  // It lapsed at 10:39:30 after 30 minutes without input: the last key was 10:09:30.
  assert.deepEqual(read(
    ws('08:24:37', 'Created', '00:00:00'),
    ws('08:39:18', 'Summary', '00:14:41'),
    ws('10:39:30', 'TimedOut', '00:30:00'),
  ), [{ start: at('08:24:37'), end: at('10:09:30') }])
})

test('a log that begins mid-stretch finds where the stretch began', () => {
  // The first line seen is a summary an hour into the assertion.
  assert.deepEqual(read(
    ws('09:00:00', 'Summary', '01:00:00'),
    ws('09:45:00', 'TimedOut', '00:30:00'),
  ), [{ start: at('08:00:00'), end: at('09:15:00') }])
})

test('closing the lid ends the stretch on the spot', () => {
  assert.deepEqual(read(
    ws('14:00:00', 'Created', '00:00:00'),
    sleep('15:10:00'),
    ws('15:10:05', 'Released', '01:10:05'),
  ), [{ start: at('14:00:00'), end: at('15:10:00') }])
})

test('programs that act for themselves are not a person at the keyboard', () => {
  assert.deepEqual(read(
    other('11:00:00', 'SkyComputerUseService'),
    other('11:05:00', 'bluetoothd'),
  ), [])
})

test('a restart that never wrote the close ends the old stretch where it was last seen', () => {
  assert.deepEqual(read(
    ws('08:00:00', 'Created', '00:00:00', '0x0xA'),
    ws('08:15:00', 'Summary', '00:15:00', '0x0xA'),
    ws('09:00:00', 'Created', '00:00:00', '0x0xB'),
    ws('10:00:00', 'TimedOut', '00:30:00', '0x0xB'),
  ), [{ start: at('08:00:00'), end: at('08:15:00') }, { start: at('09:00:00'), end: at('09:30:00') }])
})

test('someone still at the machine ends, for now, at the last summary', () => {
  assert.deepEqual(read(
    ws('20:00:00', 'Created', '00:00:00'),
    ws('20:15:00', 'Summary', '00:15:00'),
    ws('20:30:00', 'Summary', '00:30:00'),
  ), [{ start: at('20:00:00'), end: at('20:30:00') }])
})

test('a touch and away again is kept only if it lasted', () => {
  // Created and lapsed a delay later: the last key was the first one.
  assert.deepEqual(read(
    ws('17:05:11', 'Created', '00:00:00'),
    ws('17:35:11', 'TimedOut', '00:30:00'),
  ), [])
})

test('the day reads its stretches back whole, even stored twice a second apart', () => {
  db.exec('delete from presence')
  const keep = db.prepare('insert into presence (started_at, ended_at, day) values (?, ?, ?)')
  keep.run(at('08:00:00'), at('10:00:00'), '2026-09-19')
  // The same stretch, read a week later from a log that had rolled over.
  keep.run(at('08:00:01'), at('10:00:00'), '2026-09-19')
  keep.run(at('13:00:00'), at('18:00:00'), '2026-09-19')
  const day = presenceOf('2026-09-19')
  assert.equal(day.spans.length, 2)
  assert.equal(day.seconds, 2 * 3600 + 5 * 3600)
  assert.equal(day.firstAt, at('08:00:00'))
  assert.equal(day.lastAt, at('18:00:00'))
})
