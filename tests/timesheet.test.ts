import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// A database of its own, set before anything imports the core.
process.env.HIPPOCAMPUS_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'hippocampus-timesheet-'))

const { db } = await import('../core/db.ts')
const { timesheet, timesheetTable } = await import('../core/timesheet.ts')
const { labelKey } = await import('../core/jev.ts')

const MON = '2026-09-14'
const TUE = '2026-09-15'
const T = 1_789_650_000

const block = db.prepare(`insert into blocks (started_at, ended_at, seconds, day, app, title, url, host, idle)
  values (?, ?, ?, ?, ?, ?, ?, ?, 0)`)
const label = db.prepare(`insert into labels (key, app, category, project) values (?, ?, 'code', ?)`)

function seed() {
  for (const table of ['blocks', 'visits', 'commits', 'ai_turns', 'branches', 'agent_minutes', 'labels']) db.exec(`delete from ${table}`)
  // A ticket on acme's Jira, and a page in acme's Confluence space.
  block.run(T, T + 600, 600, MON, 'Google Chrome', 'SUP-12 Login fails - Jira', 'https://acme.atlassian.net/browse/SUP-12', 'acme.atlassian.net')
  block.run(T + 600, T + 900, 300, TUE, 'Google Chrome', 'Runbook - Ops', 'https://acme.atlassian.net/wiki/spaces/OPS/pages/1/Runbook', 'acme.atlassian.net')
  // The editor in harbor, a project whose tickets are acme's.
  block.run(T + 900, T + 1800, 900, MON, 'Code', 'orders.ts — harbor', null, null)
  label.run(labelKey({ app: 'Code', title: 'orders.ts — harbor', host: null }), 'Code', 'harbor')
  db.prepare(`insert into commits (sha, repo, ts, day, subject, files, insertions, deletions) values ('c1', 'harbor', ?, ?, 'SUP-12: retry', 1, 3, 1)`).run(T + 1000, MON)
  // Chat with no client to put it on.
  block.run(T + 1800, T + 2000, 200, MON, 'Slack', 'general', null, null)
}

test('each second lands on one line at most, and the rest is said to have no client', () => {
  seed()
  const sheet = timesheet(MON, TUE)
  const placed = sheet.clients.reduce((sum, client) => sum + client.seconds, 0)
  assert.equal(placed + sheet.unassigned, 600 + 300 + 900 + 200)
  assert.equal(sheet.unassigned, 200, 'the chat')
  assert.deepEqual(sheet.days, [MON, TUE])
})

test('a project goes to the client its tickets belong to', () => {
  seed()
  const acme = timesheet(MON, TUE).clients.find((client) => client.org === 'acme')
  assert.ok(acme)
  assert.equal(acme.seconds, 600 + 300 + 900)
  assert.deepEqual(acme.lines.map((line) => [line.what, line.seconds]),
    [['harbor', 900], ['SUP-12', 600], ['confluence · OPS', 300]])
  assert.equal(acme.days[MON], 1500)
  assert.equal(acme.days[TUE], 300)
})

test('the branch names the ticket, and the agent\'s minutes are counted apart', () => {
  seed()
  db.prepare(`insert into branches (repo, ts, day, branch, from_branch) values ('harbor', ?, ?, 'feature/sup-77-retry', 'main')`).run(T + 850, MON)
  const minute = (T + 1200) / 60
  const agent = db.prepare(`insert into agent_minutes (minute, agent, day, project, events) values (?, ?, ?, 'harbor', 1)`)
  agent.run(minute, 'claude', MON)
  agent.run(minute, 'codex', MON)
  agent.run(minute + 1, 'claude', MON)
  const acme = timesheet(MON, TUE).clients.find((client) => client.org === 'acme')!
  const sup77 = acme.lines.find((line) => line.what === 'SUP-77')
  assert.equal(sup77?.seconds, 900, 'the editor stretch after the switch')
  assert.equal(sup77?.agentSeconds, 120, 'two agents in one minute are one minute')
  assert.equal(acme.lines.some((line) => line.what === 'harbor'), false, 'the ticket took the project\'s time')
  assert.equal(acme.seconds, 600 + 300 + 900, 'agent time never joins the focus total')
})

test('the table is a draft anyone can paste: a row per line, a column per day', () => {
  seed()
  const table = timesheetTable(timesheet(MON, TUE), { client: 'client', total: 'total', agent: 'agent', unassigned: 'no client' })
  const lines = table.split('\n')
  assert.equal(lines[0], '| client | 09-14 | 09-15 | total | agent |')
  assert.ok(lines.includes('| **acme** | **0:25** | **0:05** | **0:30** |  |'))
  assert.ok(lines.includes('| _no client_ |  |  | 0:03 |  |'))
})
