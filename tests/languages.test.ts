import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  LANGUAGES, HOW_TO_WRITE, CATEGORIES_BY_LANGUAGE, CATEGORY_NAMES,
  LEVELS_BY_LANGUAGE, JEV_QUESTIONS, VAULT_HEADING, type Language,
} from '../core/languages.ts'
import { PERSONAS } from '../core/personas.ts'
import { DOSSIER } from '../core/dossier.ts'

const languages = Object.keys(LANGUAGES) as Language[]

// The compiler already demands that every language carry every key. What it
// cannot see is the content: a key present with another language's text pasted
// in, or a category that exists in one dictionary and not the other, both pass
// the type check.
test('the five languages share the same categories, under the same keys', () => {
  const reference = Object.keys(CATEGORIES_BY_LANGUAGE['pt-BR']).sort()
  for (const language of languages) {
    assert.deepEqual(Object.keys(CATEGORIES_BY_LANGUAGE[language]).sort(), reference,
      `${language}'s categories diverge from pt-BR's`)
    for (const key of reference) {
      assert.ok(CATEGORY_NAMES[language][key], `category ${key} has no display name in ${language}`)
    }
  }
})

test('the unlabelled category has a name in every language', () => {
  // The key is stored whenever jev is not confident enough. With no display
  // name it shows up raw, in English, in the middle of a German interface.
  for (const language of languages) {
    assert.ok(CATEGORY_NAMES[language].unlabelled, `missing in ${language}`)
  }
})

test('every language brings three complexity levels for jev', () => {
  for (const language of languages) {
    assert.equal(LEVELS_BY_LANGUAGE[language].length, 3,
      `${language} does not have the three levels the model routing expects`)
  }
})

test('no text in the core is empty or left with a placeholder', () => {
  for (const language of languages) {
    const who = PERSONAS[language]
    const texts = [
      HOW_TO_WRITE[language], who.tone,
      who.chat('Someone', '2026-09-20', 'Sunday', '14:00', 4),
      who.journal('Someone'), who.summary('2026-09-20'), who.recap('2026-09-20'),
      ...Object.values(JEV_QUESTIONS[language]),
    ]
    for (const text of texts) {
      assert.ok(text.trim().length > 10, `text too short in ${language}`)
      assert.ok(!text.includes('TODO'), `a TODO was left in ${language}`)
    }
    // The vault heading is a heading, not prose — it gets its own check.
    assert.ok(VAULT_HEADING[language].trim(), `${language} has no vault heading`)

    // %DATA% is where the day's material goes in. Without it the model gets
    // the instruction and no data at all — and answers by inventing.
    assert.ok(who.summary('x').includes('%DATA%'), `${language}'s summary lost its %DATA%`)
    assert.ok(who.recap('x').includes('%DATA%'), `${language}'s recap lost its %DATA%`)
  }
})

test('the dossier speaks of delegated work in every language', () => {
  // The distinction between idleness and delegated work is the product
  // decision easiest to lose in a translation, and the costliest to lose.
  for (const language of languages) {
    const sentence = DOSSIER[language].delegated('1h20', '0h30')
    assert.ok(sentence.includes('1h20') && sentence.includes('0h30'),
      `${language}'s dossier does not use both numbers it is given`)
    assert.ok(sentence.length > 80, `${language}'s dossier shortened the delegated-work explanation`)
  }
})

/**
 * English words that a bulk rename left sitting inside the other languages.
 *
 * Renaming identifiers across the repository reaches into string literals too,
 * and the damage is invisible: the app compiles, the screens render, and a
 * Brazilian reads "Trabalho delegated" in his own journal. These are the exact
 * words that leaked, so the next sweep cannot put them back quietly.
 */
const ENGLISH_LEAKS = [
  'delegated', 'measured', 'window', 'idle:', 'screen', 'sound', 'playing',
  'keys', 'clicks', 'from', 'day ', 'the ',
]

test('no English word is left sitting inside the other languages', async () => {
  const { DOSSIER } = await import('../core/dossier.ts')
  const { PERSONAS } = await import('../core/personas.ts')

  for (const language of ['pt-BR', 'es-ES', 'fr-FR', 'de-DE'] as const) {
    const sample = (value: unknown): string =>
      typeof value === 'function' ? String((value as (...a: any[]) => string)('1', '2', '3', '4', '5'))
      : typeof value === 'string' ? value : ''
    const text = [
      ...Object.values(DOSSIER[language] ?? {}).map(sample),
      PERSONAS[language].tone,
      PERSONAS[language].chat('Someone', '2026-09-20', 'Sunday', '14:00', 4),
      PERSONAS[language].journal('Someone'),
    ].join(' ').toLowerCase()

    for (const word of ENGLISH_LEAKS) {
      assert.ok(!text.includes(word),
        `${language} contains the English "${word.trim()}" — a rename reached into its text`)
    }
  }
})

test('the category names are translated, not left in English', async () => {
  // The donut read "IA, comunicação, distração" next to "unlabelled, research,
  // writing" — a bulk rename had reached into the Portuguese names and turned
  // three of them into their keys. These three have a word of their own in
  // every language here, so an English one showing up is a leak.
  const { CATEGORY_NAMES } = await import('../core/languages.ts')
  const english = CATEGORY_NAMES['en-US']
  for (const language of ['pt-BR', 'es-ES', 'fr-FR', 'de-DE'] as const) {
    for (const key of ['unlabelled', 'research', 'writing']) {
      assert.notEqual(CATEGORY_NAMES[language][key], english[key],
        `${language} shows "${english[key]}" for ${key} — still the English word`)
    }
  }
})
