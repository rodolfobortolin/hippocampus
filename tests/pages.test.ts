import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readPage, ticketKeys, branchKeys, cleanTitle } from '../core/pages.ts'

/**
 * URLs shaped like the ones in a real browser history, with the names
 * invented. Each reader gets the forms that actually show up, including the
 * awkward ones — a ticket opened from a board, a Confluence page with no title
 * in the path, an admin screen with a UUID in it.
 */

const pick = (address: string, title?: string) => {
  const page = readPage(address, title)
  return page && { ...page }
}

test('a Jira ticket, opened directly or from a board', () => {
  assert.deepEqual(pick('https://acme.atlassian.net/browse/SUP-1234', 'SUP-1234 Login fails - Jira'),
    { kind: 'ticket', site: 'jira', org: 'acme', key: 'SUP-1234', label: 'SUP-1234 Login fails' })
  assert.equal(pick('https://acme.atlassian.net/jira/software/projects/SUP/boards/7?selectedIssue=SUP-88')?.key, 'SUP-88')
})

test('Jira administration is its own kind of work, per site', () => {
  const apps = pick('https://globex.atlassian.net/jira/settings/apps/3fa85f64-5717-4562-b3fc-2c963f66afa6')
  assert.equal(apps?.kind, 'admin')
  assert.equal(apps?.org, 'globex')
  assert.equal(apps?.key, 'apps')
  assert.equal(pick('https://globex.atlassian.net/jira/settings/issues/fields')?.key, 'issues')
  assert.equal(pick('https://globex.atlassian.net/plugins/servlet/upm')?.kind, 'admin')
})

test('Confluence pages and spaces', () => {
  assert.deepEqual(pick('https://acme.atlassian.net/wiki/spaces/KB/pages/123456/Onboarding+checklist'),
    { kind: 'wiki', site: 'confluence', org: 'acme', key: 'KB/123456', label: 'Onboarding checklist' })
  const space = pick('https://acme.atlassian.net/wiki/spaces/KB/overview')
  assert.equal(space?.kind, 'space')
  assert.equal(space?.key, 'KB')
})

test('GitHub pull requests, issues and repositories', () => {
  assert.equal(pick('https://github.com/acme/harbor/pull/214')?.key, 'acme/harbor#214')
  assert.equal(pick('https://github.com/acme/harbor/pull/214/files')?.kind, 'pull-request')
  assert.equal(pick('https://github.com/acme/harbor/issues/9')?.kind, 'issue')
  assert.deepEqual(pick('https://github.com/acme/harbor'),
    { kind: 'repo', site: 'github', org: 'acme', key: 'acme/harbor', label: undefined })
})

test('mail never carries its subject', () => {
  const mail = pick('https://mail.google.com/mail/u/0/#inbox/FMfcgz', 'Re: contract renewal - alex@acme.dev - Gmail')
  assert.deepEqual(mail, { kind: 'mail', site: 'gmail' })
})

test('video, design, docs and meetings', () => {
  assert.equal(pick('https://www.youtube.com/watch?v=dQw4w9WgXcQ', '(3) How indexes work - YouTube')?.label, 'How indexes work')
  assert.equal(pick('https://www.figma.com/design/AbC123/Checkout-v3?node-id=1')?.label, 'Checkout v3')
  assert.equal(pick('https://docs.google.com/spreadsheets/d/1a2b3c/edit')?.kind, 'sheet')
  assert.equal(pick('https://meet.google.com/abc-defg-hij')?.kind, 'meeting')
  assert.equal(pick('https://acme.zoom.us/j/123456789')?.kind, 'meeting')
  assert.equal(pick('https://www.google.com/search?q=cursor+pagination')?.kind, 'search')
})

test('anything unknown falls back to its host, and non-web addresses to nothing', () => {
  assert.deepEqual(pick('https://example.org/some/page', 'Some page - Google Chrome'),
    { kind: 'page', site: 'example.org', label: 'Some page' })
  assert.equal(readPage('chrome://settings'), null)
  assert.equal(readPage('not a url'), null)
  assert.equal(readPage(null), null)
})

test('ticket keys are found in any text, and version numbers are not tickets', () => {
  assert.deepEqual(ticketKeys('SUP-12: fix the login, see also ECO-3 and SUP-12'), ['SUP-12', 'ECO-3'])
  assert.deepEqual(ticketKeys('upgrade to GPT-5, UTF-8 everywhere, ISO-8601 dates, CVE-2024'), [])
  assert.deepEqual(ticketKeys('branch feature/ATD-481-clinic-picker'), ['ATD-481'])
  assert.deepEqual(ticketKeys(null), [])
})

test('a branch offers the ticket in its last segment, in any case', () => {
  assert.deepEqual(branchKeys('feature/vpd-59-german-catalog'), ['VPD-59'])
  assert.deepEqual(branchKeys('fix/ETIAPP-73-optional-invite-emails'), ['ETIAPP-73'])
  assert.deepEqual(branchKeys('sup-12'), ['SUP-12'])
  // Candidates only: whether RELEASE is a ticket prefix is for the caller to know.
  assert.deepEqual(branchKeys('release-2'), ['RELEASE-2'])
  assert.deepEqual(branchKeys('main'), [])
  assert.deepEqual(branchKeys(null), [])
})

test('titles lose the browser and the site, and keep the rest', () => {
  assert.equal(cleanTitle('Pull request #214 · acme/harbor - Google Chrome - Alex (Work)'), 'Pull request #214 · acme/harbor')
  assert.equal(cleanTitle('(12) Inbox'), 'Inbox')
  assert.equal(cleanTitle(''), undefined)
})
