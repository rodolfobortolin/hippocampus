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
