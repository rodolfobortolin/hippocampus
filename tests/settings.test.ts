import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'hippocampus-test-'))
process.env.HIPPOCAMPUS_DATA = temporary

const { setMeta } = await import('../core/db.ts')
const { readSettings } = await import('../core/settings.ts')

after(() => fs.rmSync(temporary, { recursive: true, force: true }))

/**
 * The migration reads keys that are Portuguese string literals, because they
 * name rows and fields already sitting on someone's disk. A bulk rename reached
 * into this once and silently dropped everything the person had configured —
 * their name, their language, the folder their journal is written into — and
 * nothing failed, because falling back to defaults looks like a fresh install.
 */
test('settings stored under the old name are still read', () => {
  setMeta('ajustes', JSON.stringify({
    idioma: 'de-DE',
    nome: 'Someone',
    vault: temporary,
    pastaDiario: '10 Diário',
    inicioDoDia: 6,
    guardarDigitacao: false,
    voz: 'shimmer',
  }))

  const settings = readSettings()
  assert.equal(settings.language, 'de-DE', 'the chosen language was lost')
  assert.equal(settings.name, 'Someone', 'the name was lost')
  assert.equal(settings.vault, temporary, 'the vault folder was lost')
  assert.equal(settings.journalFolder, '10 Diário',
    'the journal subfolder was lost — the existing journal would be orphaned')
  assert.equal(settings.dayStartHour, 6, 'the hour the day turns was lost')
  assert.equal(settings.keepTyping, false, 'the typing choice was lost')
  assert.equal(settings.voice, 'shimmer', 'the voice was lost')
})

test('the new shape wins over the old one', () => {
  setMeta('settings', JSON.stringify({ name: 'Newer', language: 'fr-FR' }))
  const settings = readSettings()
  assert.equal(settings.name, 'Newer')
  assert.equal(settings.language, 'fr-FR')
})

test('a key longer than 128 characters comes back whole', async () => {
  // `security ... -w` with no value prompts for the password on stdin and cuts
  // it at 128 characters, silently, exit code zero. An OpenAI service-account
  // key is 167, so every one of them was stored truncated and refused by
  // OpenAI — with the person looking at a key they had pasted correctly.
  const { execFile } = await import('node:child_process')
  const { promisify } = await import('node:util')
  const run = promisify(execFile)

  const account = 'hippocampus-length-test'
  const service = 'HippocampusTest'
  const secret = `sk-svcacct-${'x'.repeat(156)}`
  assert.equal(secret.length, 167, 'the sample should be the length that broke')

  const child = execFile('security', ['-i'], () => {})
  child.stdin?.end(`add-generic-password -a ${account} -s ${service} -U -D "API key" -w ${secret}\n`)
  await new Promise((done) => child.on('close', done))

  try {
    const { stdout } = await run('security',
      ['find-generic-password', '-a', account, '-s', service, '-w'])
    assert.equal(stdout.trim(), secret, 'the key must come back exactly as it went in')
  } finally {
    await run('security', ['delete-generic-password', '-a', account, '-s', service])
      .catch(() => { /* nothing to clean up */ })
  }
})

test('the region decides where OpenAI is reached, and a proxy still wins', async () => {
  // A European project key answers /v1/models on the global host and is refused
  // by the live endpoint, so the key looks half working. The region is the
  // person's to pick, and the default `.env` line must not beat that choice.
  const { openaiBase, saveSettings } = await import('../core/settings.ts')
  const before = process.env.OPENAI_BASE_URL

  try {
    delete process.env.OPENAI_BASE_URL
    saveSettings({ region: 'global' })
    assert.equal(openaiBase(), 'https://api.openai.com/v1')
    saveSettings({ region: 'eu' })
    assert.equal(openaiBase(), 'https://eu.api.openai.com/v1')

    // The stock host sitting in .env.example must not override the choice.
    process.env.OPENAI_BASE_URL = 'https://api.openai.com/v1'
    assert.equal(openaiBase(), 'https://eu.api.openai.com/v1',
      'the default in .env must not beat what was picked on screen')

    // Somewhere that is neither of OpenAI's hosts is a proxy, set on purpose.
    process.env.OPENAI_BASE_URL = 'http://127.0.0.1:9099/v1'
    assert.equal(openaiBase(), 'http://127.0.0.1:9099/v1')
  } finally {
    if (before === undefined) delete process.env.OPENAI_BASE_URL
    else process.env.OPENAI_BASE_URL = before
    saveSettings({ region: 'global' })
  }
})
