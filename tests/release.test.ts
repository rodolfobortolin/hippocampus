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
  // site identical to the one already up. It lives on Vercel now, and the rule
  // is its ignoreCommand: skip unless something the site is built from moved.
  const vercel = JSON.parse(read('vercel.json'))
  assert.equal(vercel.buildCommand, 'npm run site:build')
  assert.equal(vercel.outputDirectory, 'site/dist')
  assert.match(read('site/vite.config.ts'), /outDir: 'dist'/)
  for (const path of ['site/', 'src/three/', 'package.json']) {
    // package.json because the page names the version: the release commit
    // has to republish it.
    assert.ok(vercel.ignoreCommand.includes(path), `vercel.json should rebuild when ${path} changes`)
  }
})

test('the old address only points at the new one', () => {
  // GitHub Pages is kept for the links already out there. A second copy of
  // the site would compete with the first in search, so it serves a redirect
  // to the address the site itself declares — the same one, never another.
  const site = /export const SITE = '([^']+)'/.exec(read('site/vite.config.ts'))?.[1]
  assert.ok(site, 'the site address is declared once, in site/vite.config.ts')
  const workflow = read('.github/workflows/site.yml')
  assert.doesNotMatch(workflow, /site:build/, 'Pages must not build a second copy of the site')
  assert.ok(workflow.includes(`rel="canonical" href="${site}"`), 'the redirect names the site as canonical')
  assert.ok(workflow.includes(`url=${site}`), 'the redirect sends the browser to the site')
})

test('the website names the version from package.json, never a number of its own', () => {
  // The button to the release notes once said v0.1.0 for a day after v0.2.0
  // was out: the number was typed into the page.
  const page = read('site/index.html')
  assert.doesNotMatch(page, /v\d+\.\d+\.\d+/, 'site/index.html should say %VERSION%, not a version number')
  assert.match(page, /releases\/tag\/v%VERSION%/)
  assert.match(read('site/vite.config.ts'), /replaceAll\('%VERSION%', version\)/)
})

test('the app carries the update config, for the same repository it checks', () => {
  // electron-updater will not download without Resources/app-update.yml, and
  // electron-builder does not write it for a folder build. v0.3.0 went out
  // without one and no copy of it could update itself.
  assert.match(read('electron-builder.yml'), /- from: build\/app-update\.yml\s*\n\s*to: app-update\.yml/,
    'the bundle carries build/app-update.yml as Resources/app-update.yml')
  const config = read('build/app-update.yml')
  const owner = /owner: (\S+)/.exec(config)?.[1]
  const repo = /repo: (\S+)/.exec(config)?.[1]
  assert.ok(owner && repo)
  assert.match(read('app/main.cjs'), new RegExp(`const UPDATES = \\{ owner: '${owner}', repo: '${repo}' \\}`),
    'the app checks the same repository its update config names')
  // Nothing is ever published by the packager: releases are uploaded by hand,
  // after the app is notarized in the right order.
  assert.match(JSON.parse(read('package.json')).scripts.dist, /--publish never/)
})
