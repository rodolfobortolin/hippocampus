import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'

/**
 * The manifest a release carries is what the app's updater reads to find the
 * next version. It is written by our script rather than by electron-builder
 * (see scripts/notarize.sh), so it is read back here by the updater's own
 * parser: a manifest the updater cannot read is a release nobody updates to,
 * and nothing on screen would say so.
 */
const require = createRequire(import.meta.url)
const { parseUpdateInfo, resolveFiles } = require('electron-updater/out/providers/Provider')

test('the update manifest is one the updater reads, with the zip it installs first', () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'hippocampus-release-'))
  fs.writeFileSync(path.join(folder, 'Hippocampus-0.3.0-arm64-mac.zip'), 'the app, zipped')
  fs.writeFileSync(path.join(folder, 'Hippocampus-arm64.dmg'), 'the disk image')

  const yml = execFileSync('node', [
    'scripts/update-manifest.mjs', folder, '0.3.0', 'Hippocampus-0.3.0-arm64-mac.zip', 'Hippocampus-arm64.dmg',
  ], { encoding: 'utf8' })

  const base = new URL('https://github.com/rodolfobortolin/hippocampus/releases/download/v0.3.0/')
  const info = parseUpdateInfo(yml, 'latest-mac.yml', new URL('latest-mac.yml', base))
  assert.equal(info.version, '0.3.0')

  const files = resolveFiles(info, base)
  assert.equal(files[0].url.href, `${base.href}Hippocampus-0.3.0-arm64-mac.zip`)
  // The digest the updater will compare against the download.
  const expected = (sha512Of(path.join(folder, 'Hippocampus-0.3.0-arm64-mac.zip')))
  assert.equal(files[0].info.sha512, expected)
  assert.equal(files[0].info.size, 'the app, zipped'.length)
})

function sha512Of(file: string): string {
  return require('node:crypto').createHash('sha512').update(fs.readFileSync(file)).digest('base64')
}
