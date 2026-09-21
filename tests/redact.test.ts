import { test } from 'node:test'
import assert from 'node:assert/strict'
import { redact } from '../core/redact.ts'

/**
 * What is typed to an agent is stored, and the close of the day hands it to
 * Claude Code. A secret pasted into a request has to be gone before either —
 * and on 21 September a Stripe test key went through untouched, because the
 * pattern knew OpenAI's hyphens and not Stripe's underscores.
 */

test('Stripe keys are taken out, secret and publishable, live and test', () => {
  const pasted = 'my keys: sk_test_51UIDduEHqwdZCBFrizXXXXXXXXXXXXXXXXXXXX and '
    + 'pk_live_51UIDdiCh8h7zW5whPSD6XXXXXXXXXXXXXXXXXXXX, webhook whsec_abcdefghijklmnop1234'
  const out = redact(pasted)
  assert.doesNotMatch(out, /sk_test_51/)
  assert.doesNotMatch(out, /pk_live_51/)
  assert.doesNotMatch(out, /whsec_/)
  assert.match(out, /my keys: «key» and «key», webhook «key»/)
})

test('a private key pasted whole is taken out, header to footer', () => {
  const pasted = 'is this it?\n-----BEGIN PRIVATE KEY-----\nMIGHAgEAMBMGByqGSM49AgEGCCqGSM49\nAwEHBG0wawIBAQQgN6fByduCzl120Oxy\n-----END PRIVATE KEY-----\nthanks'
  assert.equal(redact(pasted), 'is this it?\n«private key»\nthanks')
})

test('a private key cut before its footer still goes', () => {
  const cut = 'here: -----BEGIN EC PRIVATE KEY-----\nMIGHAgEAMBMGByqGSM49AgEGCCqGSM49\nAwEHBG0wawIBAQQgN6fByduC'
  assert.equal(redact(cut), 'here: «private key»')
})

test('what is not a secret is left as it was', () => {
  const plain = 'rename sk_ prefix in the test, pk_sequence stays, and the Task_live_view too'
  assert.equal(redact(plain), plain)
})
