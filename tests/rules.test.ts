import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// A database of its own, set before anything imports the core.
process.env.HIPPOCAMPUS_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'hippocampus-rules-'))

const { localLabel } = await import('../core/rules.ts')
const { db } = await import('../core/db.ts')
const { classifyDay, labelKey, cachedLabel } = await import('../core/jev.ts')
const { config } = await import('../core/config.ts')

// No model, whatever the project's .env says: this is the fully local case,
// and a test must never send a title to a real service with someone's key.
config.typesafeKey = ''

const projects = ['harbor', 'atlas']

test('an editor is code, and the project is taken only when the title names one exactly', () => {
  assert.deepEqual(localLabel({ app: 'Code', title: 'orders.ts — harbor' }, projects), { category: 'code', project: 'harbor' })
  assert.deepEqual(localLabel({ app: 'Terminal', title: 'atlas — npm test' }, projects), { category: 'code', project: 'atlas' })
  assert.deepEqual(localLabel({ app: 'Code', title: 'harbor-notes.md — scratch' }, projects), { category: 'code', project: null },
    'a title that merely resembles a project is not that project')
})

test('the apps that are always one thing', () => {
  assert.equal(localLabel({ app: 'Slack', title: '#general — acme' }, projects)?.category, 'communication')
  assert.equal(localLabel({ app: '‎WhatsApp', title: 'Mom' }, projects)?.category, 'communication', 'the invisible mark some apps carry')
  assert.equal(localLabel({ app: 'Figma', title: 'Checkout v3' }, projects)?.category, 'design')
  assert.equal(localLabel({ app: 'Claude', title: 'Claude' }, projects)?.category, 'ai')
})

test('a browser tab is what its page is, and nothing when the page could be either', () => {
  const chrome = (url: string, title = '') => localLabel({ app: 'Google Chrome', title, url }, projects)
  assert.equal(chrome('https://github.com/acme/harbor/pull/214')?.category, 'code')
  assert.equal(chrome('https://mail.google.com/mail/u/0/')?.category, 'communication')
  assert.equal(chrome('https://www.google.com/search?q=cursor')?.category, 'research')
  assert.equal(chrome('https://www.youtube.com/watch?v=x'), null, 'a video is work or leisure — only a model can tell')
  assert.equal(chrome('https://acme.atlassian.net/browse/SUP-12'), null, 'a ticket is left to the model')
  assert.equal(chrome('https://example.org/'), null)
  assert.equal(localLabel({ app: 'Some Unknown App', title: 'x' }, projects), null)
})

test('with no model at all, the day is still sorted where it is certain', async () => {
  const day = '2026-09-17'
  const T = 1_789_650_000
  const block = db.prepare(`insert into blocks (started_at, ended_at, seconds, day, app, title, url, host, idle) values (?, ?, ?, ?, ?, ?, ?, ?, 0)`)
  block.run(T, T + 600, 600, day, 'Code', 'orders.ts — harbor', null, null)
  block.run(T + 600, T + 900, 300, day, 'Google Chrome', 'How indexes work - YouTube', 'https://www.youtube.com/watch?v=x', 'youtube.com')
  // A label the model already gave is never overwritten by a rule.
  db.prepare(`insert into labels (key, app, sample_title, category, project, deep_work, confidence, model, created_at)
    values (?, 'Slack', 'x', 'admin', null, 0.5, 0.9, 'jev-latest', 0)`).run(labelKey({ app: 'Slack', title: '#ops', host: null }))
  block.run(T + 900, T + 1000, 100, day, 'Slack', '#ops', null, null)

  const labelled = await classifyDay(day, projects)
  assert.equal(labelled, 1, 'only the editor: the video waits for a model, Slack already had its label')
  assert.deepEqual({ ...cachedLabel(labelKey({ app: 'Code', title: 'orders.ts — harbor', host: null })) },
    { key: labelKey({ app: 'Code', title: 'orders.ts — harbor', host: null }), category: 'code', project: 'harbor', deep_work: 0.5, confidence: 1 })
  assert.equal(cachedLabel(labelKey({ app: 'Slack', title: '#ops', host: null }))?.category, 'admin')
})

test('reading your own day back in this app is looking after the work', () => {
  assert.deepEqual(localLabel({ app: 'Hippocampus', title: 'Hippocampus' }, []), { category: 'admin', project: null })
})
