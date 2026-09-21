import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// A database of its own, set before anything imports the core.
process.env.HIPPOCAMPUS_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'hippocampus-items-'))

const { db } = await import('../core/db.ts')
const { workItems, itemDetail } = await import('../core/items.ts')
const { labelKey } = await import('../core/jev.ts')

const DAY = '2026-09-17'
const T = 1_789_650_000

const block = db.prepare(`insert into blocks (started_at, ended_at, seconds, day, app, title, url, host, idle)
  values (?, ?, ?, ?, ?, ?, ?, ?, 0)`)
const visit = db.prepare(`insert into visits (ts, day, browser, url, host, title) values (?, ?, 'Chrome', ?, ?, ?)`)
const commit = db.prepare(`insert into commits (sha, repo, ts, day, subject, files, insertions, deletions)
  values (?, 'harbor', ?, ?, ?, 1, 10, 2)`)
const prompt = db.prepare(`insert into ai_turns (source_id, ts, day, project, session, prompt, tools)
  values (?, ?, ?, 'harbor', 's', ?, '[]')`)
const branch = db.prepare(`insert into branches (repo, ts, day, branch, from_branch) values ('harbor', ?, ?, ?, ?)`)
const agentMinute = db.prepare(`insert into agent_minutes (minute, agent, day, project, events) values (?, ?, ?, 'harbor', 1)`)
const label = db.prepare(`insert into labels (key, app, category, project) values (?, ?, 'code', 'harbor')`)

function seed() {
  for (const table of ['blocks', 'visits', 'commits', 'ai_turns', 'branches', 'agent_minutes', 'labels']) db.exec(`delete from ${table}`)
  block.run(T, T + 600, 600, DAY, 'Google Chrome', 'SUP-12 Login fails - Jira', 'https://acme.atlassian.net/browse/SUP-12', 'acme.atlassian.net')
  block.run(T + 600, T + 900, 300, DAY, 'Google Chrome', 'SUP-12 Login fails - Jira', 'https://acme.atlassian.net/browse/SUP-12', 'acme.atlassian.net')
  block.run(T + 900, T + 1200, 300, DAY, 'Google Chrome', 'Apps', 'https://acme.atlassian.net/jira/settings/apps/abc', 'acme.atlassian.net')
  block.run(T + 1200, T + 1500, 300, DAY, 'Google Chrome', 'Inbox', 'https://mail.google.com/mail/u/0/#inbox', 'mail.google.com')
  block.run(T + 1500, T + 1560, 60, DAY, 'Google Chrome', 'Sign in', 'https://accounts.google.com/signin', 'accounts.google.com')
  block.run(T + 1560, T + 2160, 600, DAY, 'Code', 'orders.ts — harbor', null, null)
  visit.run(T, DAY, 'https://acme.atlassian.net/browse/SUP-12', 'acme.atlassian.net', 'SUP-12 Login fails')
  visit.run(T + 5, DAY, 'https://acme.atlassian.net/browse/SUP-12', 'acme.atlassian.net', 'SUP-12 Login fails')
  commit.run('c1', T + 2000, DAY, 'SUP-12: retry the token refresh')
  // SUP-40 is never opened in a browser; it only appears in a question.
  prompt.run('p1', T + 1700, DAY, 'look at SUP-12 and SUP-40, the login loops')
}

test('a ticket gathers its time, visits, commits and questions into one line', () => {
  seed()
  const sup12 = workItems(DAY, DAY).items.find((item) => item.key === 'SUP-12')
  assert.ok(sup12)
  assert.equal(sup12.seconds, 900, 'both windows on the ticket, and nothing else')
  assert.equal(sup12.visits, 2)
  assert.equal(sup12.commits, 1)
  assert.equal(sup12.prompts, 1)
  assert.equal(sup12.org, 'acme')
})

test('a ticket only ever mentioned lands on the site its prefix lives on', () => {
  // SUP-12 was opened on acme's Jira, so SUP-40 — seen only in a prompt — is acme's too.
  seed()
  const sup40 = workItems(DAY, DAY).items.find((item) => item.key === 'SUP-40')
  assert.equal(sup40?.org, 'acme')
  assert.equal(sup40?.site, 'jira')
  assert.equal(sup40?.seconds, 0)
})

test('no second is lost and none is counted twice', () => {
  // Every browser second lands on exactly one item, except sign-in screens,
  // which are not work anyone wants listed. Windows outside the browser that
  // name no ticket are not items at all.
  seed()
  const { items } = workItems(DAY, DAY)
  const total = items.reduce((sum, item) => sum + item.seconds, 0)
  assert.equal(total, 600 + 300 + 300 + 300, 'ticket 900, admin 300, mail 300 — not the 60s sign-in, not the editor')
})

test('mail is one line, with no subject', () => {
  seed()
  const mail = workItems(DAY, DAY).items.find((item) => item.kind === 'mail')
  assert.equal(mail?.seconds, 300)
  assert.equal(mail?.label, undefined)
})

test('the client adds up everything on its site', () => {
  seed()
  const acme = workItems(DAY, DAY).orgs.find((org) => org.org === 'acme')
  assert.equal(acme?.seconds, 1200, 'the ticket and the admin screens')
})

test('one client across Jira, Confluence and GitHub is one client', () => {
  seed()
  block.run(T + 3000, T + 3300, 300, DAY, 'Google Chrome', 'Runbook', 'https://acme.atlassian.net/wiki/spaces/OPS/pages/1/Runbook', 'acme.atlassian.net')
  block.run(T + 3300, T + 3400, 100, DAY, 'Google Chrome', 'PR', 'https://github.com/ACME/harbor/pull/3', 'github.com')
  const { orgs } = workItems(DAY, DAY)
  const acme = orgs.filter((org) => org.org.toLowerCase() === 'acme')
  assert.equal(acme.length, 1, 'merged, not listed three times')
  assert.deepEqual(acme[0].sites.sort(), ['confluence', 'github', 'jira'])
  assert.equal(acme[0].seconds, 1200 + 300 + 100)
})

test('a ticket knows the project it was worked on in', () => {
  seed()
  const sup12 = workItems(DAY, DAY).items.find((item) => item.key === 'SUP-12')
  assert.equal(sup12?.project, 'harbor')
})

test('the detail of a ticket is every moment that touched it, in order', () => {
  seed()
  const { item, touches } = itemDetail('SUP-12', DAY, DAY)
  assert.equal(item?.key, 'SUP-12')
  assert.deepEqual(touches.map((touch) => touch.source), ['window', 'visit', 'visit', 'window', 'prompt', 'commit'])
})

test('a window outside the browser naming a ticket joins the same line', () => {
  seed()
  block.run(T + 3000, T + 3120, 120, DAY, 'Code', 'SUP-12 notes.md — harbor', null, null)
  const sup12 = workItems(DAY, DAY).items.filter((item) => item.key === 'SUP-12')
  assert.equal(sup12.length, 1, 'one line, on acme\'s Jira, not a second one with no client')
  assert.equal(sup12[0].seconds, 900 + 120)
})

/**
 * The branch a repository sat on joins in what names nothing: after the
 * switch to feature/sup-77-retry, the commit, the question, the agent's
 * minutes and the editor stretch in harbor are SUP-77's.
 */
function onBranch(name: string) {
  seed()
  branch.run(T + 2200, DAY, name, 'main')
  commit.run('c2', T + 2500, DAY, 'Handle the expired token')
  prompt.run('p2', T + 2600, DAY, 'why does the refresh loop?')
  const minute = (T + 2700) / 60
  agentMinute.run(minute, 'claude', DAY)
  agentMinute.run(minute, 'codex', DAY)
  agentMinute.run(minute + 1, 'claude', DAY)
  block.run(T + 2800, T + 3100, 300, DAY, 'Code', 'token.ts — harbor', null, null)
  label.run(labelKey({ app: 'Code', title: 'token.ts — harbor', host: null }), 'Code')
}

test('work on a branch belongs to its ticket, whatever the text says', () => {
  onBranch('feature/sup-77-retry')
  const { items } = workItems(DAY, DAY)
  const sup77 = items.find((item) => item.key === 'SUP-77')
  assert.ok(sup77)
  assert.equal(sup77.commits, 1)
  assert.equal(sup77.prompts, 1)
  assert.equal(sup77.agentSeconds, 120, 'two agents in one minute are one minute')
  assert.equal(sup77.seconds, 300, 'the editor stretch in harbor')
  assert.equal(sup77.org, 'acme', 'SUP lives on acme\'s Jira')
  assert.equal(sup77.project, 'harbor')
  // Before the switch the repository was on main, which names nothing.
  const sup12 = items.find((item) => item.key === 'SUP-12')
  assert.equal(sup12?.commits, 1)
  assert.equal(sup12?.prompts, 1)
})

test('a branch whose prefix is a ticket nowhere else is not a ticket', () => {
  onBranch('release-2')
  assert.equal(workItems(DAY, DAY).items.some((item) => item.key === 'RELEASE-2'), false)
})

test('the detail of a branch ticket starts at the switch', () => {
  onBranch('feature/sup-77-retry')
  const { touches } = itemDetail('SUP-77', DAY, DAY)
  assert.deepEqual(touches.map((touch) => touch.source), ['branch', 'commit', 'prompt', 'agent', 'window'])
  assert.equal(touches[3].seconds, 120, 'the agent\'s minutes are one moment, not two')
})

test('a Jira address pasted into a question teaches where its prefix lives', () => {
  // OPS is never opened in the browser; the address sits inside a question,
  // and a later commit names OPS-10 with no address at all.
  seed()
  prompt.run('p3', T + 2600, DAY, 'https://globex.atlassian.net/browse/OPS-9 can you look at this one')
  commit.run('c3', T + 2700, DAY, 'OPS-10: raise the limit')
  const { items } = workItems(DAY, DAY)
  assert.equal(items.find((item) => item.key === 'OPS-10')?.org, 'globex')
  assert.equal(items.find((item) => item.key === 'OPS-10')?.site, 'jira')
})

test('a ticket only ever seen in a focused tab still teaches its client to the commits', () => {
  // No visit in the history at all: the tab was measured, never recorded by the browser.
  seed()
  db.exec('delete from visits')
  const sup12 = workItems(DAY, DAY).items.filter((item) => item.key === 'SUP-12')
  assert.equal(sup12.length, 1, 'the commit joins the tab\'s line instead of starting one with no client')
  assert.equal(sup12[0].org, 'acme')
  assert.equal(sup12[0].commits, 1)
})

test('the browser\'s time by kind is the pages\' own, not the editor\'s on a branch', () => {
  onBranch('feature/sup-77-retry')
  const { items, kinds } = workItems(DAY, DAY)
  const sup77 = items.find((item) => item.key === 'SUP-77')
  assert.equal(sup77?.seconds, 300)
  assert.equal(sup77?.browserSeconds, 0, 'the editor stretch was not on a page')
  assert.equal(kinds.find((kind) => kind.kind === 'ticket')?.seconds, 900, 'only SUP-12\'s two tabs')
})
