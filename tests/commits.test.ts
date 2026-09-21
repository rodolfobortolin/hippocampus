import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// A database of its own: this test writes commits, and the real one must not
// see a single fake row. Set before anything imports the core.
process.env.HIPPOCAMPUS_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'hippocampus-commits-'))

const { db } = await import('../core/db.ts')
const { keepCommit } = await import('../core/sources/git.ts')

const rows = () => db.prepare('select sha, repo, subject from commits order by id').all() as
  { sha: string; repo: string; subject: string }[]

/**
 * One row per piece of work, not per hash.
 *
 * The day this repository's history was rewritten into English, 88 commits
 * were counted three times — once per generation of hashes — and a rebased
 * branch elsewhere counted twice. These replay exactly that.
 */

test('a rewritten commit replaces the old one instead of joining it', () => {
  db.exec('delete from commits')
  keepCommit('aaa1', 'hipocampo', 1_790_000_000, 'Mostrar as mãos', 3, 120, 8)
  keepCommit('bbb2', 'hippocampus', 1_790_000_000, 'Show the hands', 3, 120, 8)
  keepCommit('ccc3', 'hippocampus', 1_790_000_000, 'Show the hands', 3, 120, 8)
  const kept = rows()
  assert.equal(kept.length, 1, 'three generations of one commit are one commit')
  assert.deepEqual({ ...kept[0] }, { sha: 'ccc3', repo: 'hippocampus', subject: 'Show the hands' },
    'the newest hash, name and message win')
})

test('different work in the same second stays separate', () => {
  db.exec('delete from commits')
  keepCommit('d1', 'atlas', 1_790_000_100, 'One change', 1, 4, 1)
  keepCommit('d2', 'harbor', 1_790_000_100, 'Another change', 2, 30, 0)
  assert.equal(rows().length, 2)
})

test('empty commits are never merged by fingerprint', () => {
  // Two merges in one second have the same empty fingerprint and are still
  // two merges.
  db.exec('delete from commits')
  keepCommit('m1', 'atlas', 1_790_000_200, 'Merge branch a', 0, 0, 0)
  keepCommit('m2', 'harbor', 1_790_000_200, 'Merge branch b', 0, 0, 0)
  assert.equal(rows().length, 2)
})

test('the same hash from a second checkout keeps the name it had', () => {
  // A worktree is the same repository in another folder; harvesting both must
  // not flip the row's name back and forth on every pass.
  db.exec('delete from commits')
  keepCommit('w1', 'atende', 1_790_000_300, 'Add the clinic picker', 4, 80, 12)
  keepCommit('w1', 'atende-worktree', 1_790_000_300, 'Add the clinic picker', 4, 80, 12)
  const kept = rows()
  assert.equal(kept.length, 1)
  assert.equal(kept[0].repo, 'atende')
})
