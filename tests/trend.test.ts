import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

process.env.HIPPOCAMPUS_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'hippocampus-trend-'))

const { db } = await import('../core/db.ts')
const { rangeReport, dayReport } = await import('../core/metrics.ts')
const { labelKey } = await import('../core/jev.ts')

/**
 * The trend draws one reading per day and lets the person pick which. Each of
 * them is counted here, in SQL, over the whole period — which is the only
 * reason ninety days can be drawn at all — so each of them is checked here too.
 */

const at = (day: string, hour: number, minute = 0) =>
  Math.floor(new Date(`${day}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00-03:00`).getTime() / 1000)

function block(day: string, hour: number, app: string, seconds = 600, idle = 0) {
  db.prepare(
    `insert into blocks (day, started_at, ended_at, seconds, app, bundle, title, idle)
     values (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(day, at(day, hour), at(day, hour) + seconds, seconds, app, `com.${app}`, `${app} window`, idle)
}

const minute = (day: string, at: number, agent = 'claude') =>
  db.prepare('insert or ignore into agent_minutes (minute, day, agent, project) values (?, ?, ?, ?)')
    .run(at, day, agent, 'harbor')

test('each reading of the trend is counted per day', () => {
  // A day of four windows: three switches in a row, one repeat that is not one.
  block('2026-09-18', 9, 'Code')
  block('2026-09-18', 10, 'Chrome')
  block('2026-09-18', 11, 'Chrome')
  block('2026-09-18', 12, 'Slack')
  // An idle block never counts as a switch.
  block('2026-09-18', 13, 'Finder', 600, 1)

  const base = Math.floor(at('2026-09-18', 14) / 60)
  for (let i = 0; i < 25; i++) minute('2026-09-18', base + i)

  db.prepare(
    `insert into commits (sha, repo, day, ts, subject, files, insertions, deletions)
     values (?, ?, ?, ?, ?, 1, 1, 0)`,
  ).run('a1', 'harbor', '2026-09-18', at('2026-09-18', 15), 'pagination')

  const [day] = rangeReport('2026-09-18', '2026-09-18')
  assert.equal(day.active, 4 * 600, 'the idle block is not active time')
  assert.equal(day.switches, 2, 'Code→Chrome and Chrome→Slack; the repeat is not a switch')
  assert.equal(day.delegated, 25 * 60)
  assert.equal(day.commits, 1)
})

test('a day with nothing of a reading says zero, not nothing', () => {
  block('2026-09-19', 9, 'Code')
  const [day] = rangeReport('2026-09-19', '2026-09-19')
  assert.equal(day.switches, 0, 'one window is not a switch')
  assert.equal(day.delegated, 0)
  assert.equal(day.commits, 0)
})

test('switches never cross the boundary between two days', () => {
  block('2026-09-20', 23, 'Code')
  block('2026-09-21', 9, 'Slack')
  const days = rangeReport('2026-09-20', '2026-09-21')
  assert.deepEqual(days.map((d) => d.switches), [0, 0])
})

function labelled(app: string, project: string | null, category = 'code') {
  db.prepare(
    `insert or replace into labels (key, app, sample_title, category, project, deep_work, confidence, model, created_at)
     values (?, ?, ?, ?, ?, 1, 0.9, 'test', 0)`,
  ).run(labelKey({ app, title: `${app} window`, host: null }), app, `${app} window`, category, project)
}

test('going through a window with no project is not a project switch', () => {
  labelled('Code', 'harbor')
  labelled('Claude', null, 'ai')
  labelled('Zed', 'atlas')
  // Editor, assistant, editor, assistant, editor — all on harbor — then atlas.
  for (const [hour, app] of [[9, 'Code'], [10, 'Claude'], [11, 'Code'], [12, 'Claude'], [13, 'Code'], [14, 'Zed']] as [number, string][]) {
    block('2026-09-22', hour, app)
  }
  const day = dayReport('2026-09-22')
  assert.equal(day.switches, 5, 'every change of app is still a switch')
  assert.equal(day.switchesProject, 1, 'only harbor → atlas left one piece of work for another')
})
