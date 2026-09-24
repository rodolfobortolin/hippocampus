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
  for (const table of ['blocks', 'visits', 'commits', 'ai_turns', 'branches', 'agent_minutes', 'labels', 'repos', 'meetings', 'meta']) db.exec(`delete from ${table}`)
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
  const table = timesheetTable(timesheet(MON, TUE), { client: 'client', total: 'total', agent: 'agent', unassigned: 'no client', personal: 'personal' })
  const lines = table.split('\n')
  assert.equal(lines[0], '| client | 09-14 | 09-15 | total | agent |')
  assert.ok(lines.includes('| **acme** | **0:25** | **0:05** | **0:30** |  |'))
  assert.ok(lines.includes('| _no client_ |  |  | 0:03 |  |'))
})

const { setMeta } = await import('../core/db.ts')
const { parseRemote, mainOf } = await import('../core/sources/git.ts')
const repo = db.prepare(`insert into repos (name, main, host, owner, path, worked, seen_at) values (?, ?, 'github.com', ?, ?, ?, 0)`)
const meeting = db.prepare(`insert into meetings (id, started_at, ended_at, day, title, calendar, attendees, domains) values (?, ?, ?, ?, ?, 'Work', ?, ?)`)
const NOW = T + 86_400 * 7

test('a remote says whose a repository is, whatever the host and however it is written', () => {
  assert.deepEqual(parseRemote('git@github.com:acme/api.git'), { host: 'github.com', owner: 'acme', path: 'acme/api' })
  assert.equal(parseRemote('https://user:token@bitbucket.org/acme-consultants/x.git')?.owner, 'acme-consultants')
  assert.equal(parseRemote('https://user:token@bitbucket.org/acme/x.git')?.path, 'acme/x', 'the token is left behind')
  assert.equal(parseRemote('ssh://git@gitlab.acme.io:2222/ops/infra')?.owner, 'ops')
  assert.equal(parseRemote('git@ssh.dev.azure.com:v3/acme/web/app')?.owner, 'acme')
  assert.equal(parseRemote('/a/local/path'), null)
  assert.equal(mainOf('harbor-sup12', '/Users/x/code/harbor/.git\n'), 'harbor', 'a worktree is its repository')
  assert.equal(mainOf('harbor', ''), 'harbor')
})

test('a project without tickets goes to the owner of its remote, spelled as the client already known', () => {
  seed()
  block.run(T + 2000, T + 2600, 600, MON, 'Code', 'sync.ts — migrator', null, null)
  label.run(labelKey({ app: 'Code', title: 'sync.ts — migrator', host: null }), 'Code', 'migrator')
  repo.run('migrator', 'migrator', 'acme-consultants', 'acme-consultants/migrator', 1)
  const acme = timesheet(MON, TUE, NOW).clients.find((client) => client.org === 'acme')!
  assert.equal(acme.lines.find((line) => line.what === 'migrator')?.seconds, 600)
  assert.equal(timesheet(MON, TUE, NOW).clients.some((client) => client.org === 'acme-consultants'), false, 'one client, not two')
})

test('the person\'s own repositories are theirs, shown apart and never as a client', () => {
  seed()
  setMeta('you', JSON.stringify(['Ana Lima', 'analima']))
  block.run(T + 2000, T + 2600, 600, MON, 'Code', 'app.ts — sidequest', null, null)
  label.run(labelKey({ app: 'Code', title: 'app.ts — sidequest', host: null }), 'Code', 'sidequest')
  repo.run('sidequest', 'sidequest', 'analima', 'analima/sidequest', 1)
  const sheet = timesheet(MON, TUE, NOW)
  assert.equal(sheet.personal?.lines.find((line) => line.what === 'sidequest')?.seconds, 600)
  assert.equal(sheet.clients.some((client) => client.org === 'analima'), false)
  const table = timesheetTable(sheet, { client: 'client', total: 'total', agent: 'agent', unassigned: 'no client', personal: 'personal' })
  assert.ok(table.includes('| **personal** |'))
})

test('reading a stranger\'s public repository is not work for them; a clone never committed to neither', () => {
  seed()
  block.run(T + 2000, T + 2300, 300, MON, 'Google Chrome', 'someone/tool: a tool', 'https://github.com/someone/tool', 'github.com')
  block.run(T + 2300, T + 2600, 300, MON, 'Google Chrome', 'tried/thing', 'https://github.com/tried/thing', 'github.com')
  repo.run('thing', 'thing', 'tried', 'tried/thing', 0)
  const sheet = timesheet(MON, TUE, NOW)
  assert.equal(sheet.clients.some((client) => client.org === 'someone' || client.org === 'tried'), false)
  assert.equal(sheet.unassigned, 200 + 600)
})

test('a chat or an inbox that names a known client is that client\'s', () => {
  seed()
  block.run(T + 2000, T + 2600, 600, MON, 'Microsoft Teams', 'Chat | Jo Park | ACME | ana@acme.com | Microsoft Teams', null, null)
  block.run(T + 2600, T + 2900, 300, MON, 'Microsoft Outlook', 'Inbox • ana@acme.com', null, null)
  block.run(T + 2900, T + 3000, 100, MON, 'Mail', 'Inbox • ana@gmail.com', null, null)
  const acme = timesheet(MON, TUE, NOW).clients.find((client) => client.org === 'acme')!
  assert.equal(acme.lines.find((line) => line.what === 'Microsoft Teams')?.seconds, 600)
  assert.equal(acme.lines.find((line) => line.what === 'Microsoft Outlook')?.seconds, 300)
  assert.equal(timesheet(MON, TUE, NOW).unassigned, 200 + 100, 'free mail is nobody\'s')
})

test('a meeting with guests counts where the Mac saw no focus, for the client its guests are from', () => {
  seed()
  setMeta('you.domains', JSON.stringify(['myco.com']))
  // Half of it over the editor stretch, which is already on its line.
  meeting.run('m1', T + 1350, T + 2250, MON, 'Weekly sync', 3, JSON.stringify(['myco.com', 'acme.com']))
  meeting.run('m2', T + 5000, T + 5600, MON, 'Canceled: Weekly sync', 3, JSON.stringify(['acme.com']))
  meeting.run('m3', T + 6000, T + 6600, MON, 'Dentist', 0, null)
  const acme = timesheet(MON, TUE, NOW).clients.find((client) => client.org === 'acme')!
  const sync = acme.lines.find((line) => line.what === 'Weekly sync')
  assert.equal(sync?.kind, 'meeting')
  assert.equal(sync?.seconds, 900 - 450 - 200, 'only what the editor and the chat did not already cover')
  assert.equal(acme.lines.some((line) => line.what.startsWith('Canceled')), false)
  assert.equal(timesheet(MON, TUE, T + 1400).clients.find((client) => client.org === 'acme')?.lines.some((line) => line.kind === 'meeting'), false,
    'a meeting counts only up to now')
})

test('an AI app\'s window is in the project of the question asked in it; an agent minute with no owner is said', () => {
  seed()
  block.run(T + 2000, T + 2600, 600, MON, 'Claude', 'Claude', null, null)
  db.prepare(`insert into labels (key, app, category, project) values (?, 'Claude', 'ai', '')`).run(labelKey({ app: 'Claude', title: 'Claude', host: null }))
  db.prepare(`insert into ai_turns (source_id, ts, day, project, prompt) values ('t1', ?, ?, 'harbor', 'fix the retry')`).run(T + 2100, MON)
  db.prepare(`insert into agent_minutes (minute, agent, day, project, events) values (?, 'claude', ?, 'nowhere', 1)`).run((T + 2100) / 60, MON)
  const sheet = timesheet(MON, TUE, NOW)
  const acme = sheet.clients.find((client) => client.org === 'acme')!
  assert.equal(acme.lines.find((line) => line.what === 'harbor')?.seconds, 900 + 600)
  assert.equal(sheet.unassignedAgent, 60)
})

test('what the person said outranks every rule, and taking it back lets the rules decide again', () => {
  seed()
  repo.run('harbor', 'harbor', 'acme', 'acme/harbor', 1)
  block.run(T + 2000, T + 2300, 300, MON, 'Profit', 'Profit', null, null)
  const personal = timesheet(MON, TUE, NOW, { 'repo:harbor': { as: 'personal' }, 'place:Profit': { as: 'personal' } })
  assert.equal(personal.personal?.lines.find((line) => line.what === 'harbor')?.seconds, 900)
  assert.equal(personal.personal?.lines.find((line) => line.what === 'Profit')?.seconds, 300)
  const none = timesheet(MON, TUE, NOW, { 'site:acme': { as: 'none' } })
  assert.equal(none.clients.find((client) => client.org === 'acme')?.lines.some((line) => line.what === 'confluence · OPS'), false)
  const renamed = timesheet(MON, TUE, NOW, { 'owner:acme': { as: 'client', client: 'Acme Corp' } })
  assert.ok(renamed.clients.some((client) => client.org === 'Acme Corp'))
  assert.equal(timesheet(MON, TUE, NOW, {}).personal, null)
})

test('a browser profile named after a client, in parentheses, is that client', () => {
  seed()
  block.run(T + 2000, T + 2600, 600, MON, 'Google Chrome', 'Remote desktop - Google Chrome - Ana (Acme)', null, null)
  const acme = timesheet(MON, TUE, NOW, {}).clients.find((client) => client.org === 'acme')!
  assert.equal(acme.lines.find((line) => line.what === 'Google Chrome')?.seconds, 600)
})

test('the time no rule placed is listed by place, for the person and for jev to be asked about', () => {
  seed()
  const sheet = timesheet(MON, TUE, NOW, {})
  assert.deepEqual(sheet.leftovers.map((leftover) => [leftover.place, leftover.seconds]), [['Slack', 200]])
  assert.equal(sheet.leftovers[0].windows[0].title, 'general')
  assert.equal(timesheet(MON, TUE, NOW, { 'place:Slack': { as: 'none' } }).leftovers.length, 0, 'an answered place is not asked again')
})

test('the walkthrough lists what it found: sure things settled, doubtful ones asked', async () => {
  seed()
  const { foundOwners } = await import('../core/owners.ts')
  setMeta('you', JSON.stringify(['analima']))
  repo.run('sidequest', 'sidequest', 'analima', 'analima/sidequest', 1)
  repo.run('acme-tools', 'acme-tools', 'analima', 'analima/acme-tools', 1)
  repo.run('borrowed', 'borrowed', 'someone', 'someone/borrowed', 0)
  repo.run('api', 'api', 'newco', 'newco/api', 1)
  const found = new Map(foundOwners(NOW).map((item) => [item.key, item]))
  assert.deepEqual([found.get('site:acme')?.suggestion, found.get('site:acme')?.sure], [{ as: 'client', client: 'acme' }, true],
    'its tickets are in a commit')
  assert.deepEqual([found.get('owner:analima')?.suggestion, found.get('owner:analima')?.sure], [{ as: 'personal' }, true])
  assert.deepEqual([found.get('owner:someone')?.suggestion, found.get('owner:someone')?.reason], [{ as: 'none' }, 'cloned'])
  assert.deepEqual([found.get('owner:newco')?.sure, found.get('owner:newco')?.reason], [false, 'commits'], 'commits, but whose?')
  assert.deepEqual([found.get('repo:acme-tools')?.sure, found.get('repo:acme-tools')?.detail.client], [false, 'acme'],
    'the person\'s own, named after a client')
  assert.equal(found.has('repo:sidequest'), false)
  const list = foundOwners(NOW)
  assert.equal(list[0].sure, false, 'the doubtful ones come first')
})
