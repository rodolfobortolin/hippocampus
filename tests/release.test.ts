import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * The release process, held to its own rules.
 *
 * CI no longer runs on every push, so nothing would notice if a trigger crept
 * back onto main, or if a release went out with the app still calling itself
 * the previous version. These notice.
 */

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

test('the pipeline does not run on every push to main', () => {
  // It runs on release tags, pull requests and by hand. A push trigger on the
  // main branch would put it back on every commit, which is what it was moved
  // off of.
  const workflow = read('.github/workflows/build.yml')
  const on = workflow.slice(workflow.indexOf('\non:'), workflow.indexOf('\njobs:'))
  assert.doesNotMatch(on, /branches:/, 'build.yml should not trigger on pushes to a branch')
  assert.match(on, /tags:\s*\['v\*'\]/, 'build.yml should run on release tags')
  assert.match(on, /workflow_dispatch/, 'build.yml should be runnable by hand')
})


test('the changelog keeps a place for what is not released yet', () => {
  assert.match(read('CHANGELOG.md'), /^## Unreleased$/m,
    'CHANGELOG.md needs an "## Unreleased" section to record changes as they land')
})

test('the latest release in the changelog is the version the app reports', () => {
  // Both move at release time, by hand. Forgetting one leaves the app calling
  // itself a version whose notes describe something else.
  const latest = read('CHANGELOG.md').match(/^## v(\d+\.\d+\.\d+)/m)?.[1]
  const version = JSON.parse(read('package.json')).version
  assert.equal(latest, version,
    `CHANGELOG.md's latest release is v${latest} but package.json says ${version}`)
})

test('the website publishes when the site changes, not on every commit', () => {
  // The same rule as the pipeline: a commit to the app alone would publish a
  // site identical to the one already up.
  const workflow = read('.github/workflows/site.yml')
  const on = workflow.slice(workflow.indexOf('\non:'), workflow.indexOf('\npermissions:'))
  assert.match(on, /paths:/, 'site.yml should only run when the files the site is built from change')
  assert.match(on, /'site\/\*\*'/)
  assert.match(on, /workflow_dispatch/, 'site.yml should be runnable by hand')
  // And what it publishes is what `npm run site:build` writes.
  assert.match(workflow, /path: site\/dist/)
  assert.match(read('site/vite.config.ts'), /outDir: 'dist'/)
})
