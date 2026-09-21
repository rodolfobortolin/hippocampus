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

