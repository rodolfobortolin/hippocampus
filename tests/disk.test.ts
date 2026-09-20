import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'

/**
 * No source may touch disk synchronously.
 *
 * This was solved once already, in `skysight.ts`, and came back in the other
 * sources — the kind of rule that only survives if something checks. The cost
 * of breaking it is high and the symptom is mute: inside a folder macOS
 * protects the call does not error, it stops, and stops the whole collector
 * with it. The server says it is up and no route answers.
 */
const FORBIDDEN = [
  'readdirSync', 'readFileSync', 'existsSync', 'statSync', 'lstatSync',
  'openSync', 'readSync', 'closeSync', 'writeFileSync', 'accessSync',
]

test('no data source reads disk synchronously', async () => {
  const dir = path.join(import.meta.dirname, '..', 'core', 'sources')
  const problems: string[] = []

  for (const name of await fs.readdir(dir)) {
    if (!name.endsWith('.ts')) continue
    const text = await fs.readFile(path.join(dir, name), 'utf8')
    text.split('\n').forEach((line, i) => {
      // A comment naming the function is how this file documents the rule;
      // what matters is the call.
      const withoutComment = line.replace(/\/\/.*$/, '').replace(/^\s*\*.*$/, '')
      for (const forbidden of FORBIDDEN) {
        if (withoutComment.includes(`${forbidden}(`)) {
          problems.push(`${name}:${i + 1} uses ${forbidden}`)
        }
      }
    })
  }

  assert.deepEqual(problems, [],
    `synchronous disk in a source freezes the whole collector:\n  ${problems.join('\n  ')}`)
})
