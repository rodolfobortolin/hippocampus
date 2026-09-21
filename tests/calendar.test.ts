import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// A database of its own, set before anything imports the core.
process.env.HIPPOCAMPUS_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'hippocampus-calendar-'))

const { db } = await import('../core/db.ts')
const { keepMeetings, meetingsOf, forgetMeetings, calendarAsk } = await import('../core/sources/calendar.ts')
const { dayOf } = await import('../core/config.ts')

// Ten in the morning, local time, on an ordinary day.
const T = Math.floor(new Date(2026, 8, 17, 10, 0, 0).getTime() / 1000)
const DAY = dayOf(T)
const window = { from: T - 10 * 3600, to: T + 14 * 3600 }

const standup = { id: 'E1', title: 'Standup', start: T, end: T + 900, calendar: 'Work', attendees: 6 }
const review = { id: 'E2', title: 'Sprint review', start: T + 3600, end: T + 7200, calendar: 'Work', attendees: 12 }

test('a recurring meeting is one event many times', () => {
  db.exec('delete from meetings')
  keepMeetings(window.from, window.to, [standup, { ...standup, start: T + 86_400, end: T + 86_400 + 900 }])
  assert.equal((db.prepare('select count(*) n from meetings').get() as { n: number }).n, 2)
})

test('a meeting gone from the calendar goes from here, and only inside the window read', () => {
  db.exec('delete from meetings')
  keepMeetings(window.from, window.to, [standup, review])
  // Next week's review, outside this window, must survive a sync of today.
  keepMeetings(T + 7 * 86_400 - 3600, T + 7 * 86_400 + 3600, [{ ...review, start: T + 7 * 86_400, end: T + 7 * 86_400 + 3600 }])
  keepMeetings(window.from, window.to, [standup])
  const titles = (db.prepare('select title from meetings order by started_at').all() as { title: string }[]).map((m) => m.title)
  assert.deepEqual(titles, ['Standup', 'Sprint review'], 'today\'s review was cancelled; next week\'s is untouched')
})

test('a meeting knows how much of it had a microphone open, idle or not', () => {
  db.exec('delete from meetings; delete from blocks')
  keepMeetings(window.from, window.to, [standup, review])
  const block = db.prepare(`insert into blocks (started_at, ended_at, seconds, day, app, idle, mic) values (?, ?, ?, ?, 'Zoom', ?, ?)`)
  // In the standup from two minutes in, typing for five minutes then just listening.
  block.run(T + 120, T + 420, 300, DAY, 0, 1)
  block.run(T + 420, T + 1200, 780, DAY, 1, 1)
  // Music during the review, microphone closed.
  block.run(T + 3600, T + 5400, 1800, DAY, 0, 0)
  const [first, second] = meetingsOf(DAY)
  assert.equal(first.title, 'Standup')
  assert.equal(first.onCall, 900 - 120, 'from 10:02 to the end at 10:15, including the idle listening')
  assert.equal(second.onCall, 0, 'booked, not joined — and the screen says so')
})

test('turning it off forgets what it brought', () => {
  keepMeetings(window.from, window.to, [standup])
  forgetMeetings()
  assert.equal(meetingsOf(DAY).length, 0)
})

test('the helper is asked for yesterday to tomorrow', () => {
  const ask = calendarAsk(true, T)
  assert.equal(ask.wanted, true)
  assert.ok(ask.from < T - 10 * 3600 && ask.to > T + 14 * 3600)
  assert.equal(ask.to - ask.from, 3 * 86_400)
  assert.equal(calendarAsk(false, T).wanted, false)
})
