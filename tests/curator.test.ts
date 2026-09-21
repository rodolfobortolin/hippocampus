import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

process.env.HIPPOCAMPUS_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'hippocampus-curator-'))

const { config } = await import('../core/config.ts')
const { db } = await import('../core/db.ts')
const { readProposals, material, curate, capturesOf } = await import('../core/curator.ts')
const { listNotes } = await import('../core/notes.ts')

/**
 * The curator is the half that does not depend on anyone remembering. It reads
 * the day's own asking and writes the few durable things into the person's
 * notes — which means everything here is about not writing the wrong thing:
 * not twice, not invented, and not when the answer came back as prose.
 */

const DAY = '2026-09-21'

function vault(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hippocampus-cvault-'))
  config.vault = root
  config.lang = 'pt-BR'
  return root
}

function asked(text: string, project = 'hipocampo', at = '2026-09-21T14:00:00-03:00') {
  db.prepare('insert into ai_turns (source_id, ts, day, project, session, prompt, tools) values (?, ?, ?, ?, ?, ?, ?)')
    .run(`t-${Math.random()}`, Math.floor(Date.parse(at) / 1000), DAY, project, 's1', text, '')
}

test('the material is the person’s own asking, never the answers', () => {
  const root = vault()
  fs.mkdirSync(path.join(root, '20 Projetos'))
  fs.writeFileSync(path.join(root, '20 Projetos', 'Hipocampo.md'), '# Hipocampo\n\n## Histórico\n')
  asked('aposenta o jarvis e tira o MCP do claude code')
  asked('e o site, mostra a versão certa?')

  const text = material(DAY)
  assert.match(text, /aposenta o jarvis/)
  assert.match(text, /\[hipocampo\]/)
  // The list of notes it may update comes along, so it stops inventing titles.
  assert.match(text, /Notas que já existem no cofre/)
  assert.match(text, /- project: Hipocampo/)
})

test('prose, fences and unknown kinds do not become notes', () => {
  assert.deepEqual(readProposals('Hoje não rendeu nada durável.'), [])
  assert.deepEqual(readProposals(''), [])
  assert.deepEqual(readProposals('[]'), [])

  const fenced = readProposals('```json\n[{"kind":"projeto","title":"Hipocampo","text":"as notas entraram"}]\n```')
  assert.deepEqual(fenced, [{ kind: 'project', title: 'Hipocampo', text: 'as notas entraram' }])

  // A kind nobody defined, an empty title and a repeated one are all dropped.
  const mixed = readProposals(JSON.stringify([
    { kind: 'receita', title: 'Bolo', text: 'não' },
    { kind: 'conhecimento', title: '', text: 'sem título' },
    { kind: 'pessoa', title: 'Ana', text: 'ficou de mandar o escopo' },
    { kind: 'person', title: 'ana', text: 'de novo' },
  ]))
  assert.deepEqual(mixed, [{ kind: 'person', title: 'Ana', text: 'ficou de mandar o escopo' }])
})

test('at most five, whatever the model answers', () => {
  const many = readProposals(JSON.stringify(
    Array.from({ length: 9 }, (_, i) => ({ kind: 'inbox', title: `Ideia ${i}`, text: 'x' }))))
  assert.equal(many.length, 5)
})

test('a day already written is not written again', async () => {
  const root = vault()
  db.prepare('insert into captures (day, kind, title, file, created, at) values (?, ?, ?, ?, 1, 0)')
    .run(DAY, 'project', 'Hipocampo', path.join(root, '20 Projetos', 'Hipocampo.md'))

  // No model is reachable here; the guard has to return before asking it.
  const again = await curate(DAY)
  assert.deepEqual(again, [])
  assert.equal(capturesOf(DAY).length, 1)
})

test('with no vault there is nothing to write, and nothing is asked', async () => {
  config.vault = ''
  assert.deepEqual(await curate('2026-09-20'), [])
  assert.deepEqual(capturesOf('2026-09-20'), [])
})

test('what the curator writes lands in the person’s notes, once', async () => {
  const root = vault()
  const { capture } = await import('../core/notes.ts')
  // What curate() does with each proposal, checked without a model in the way.
  for (const proposal of readProposals(JSON.stringify([
    { kind: 'projeto', title: 'Hipocampo', text: 'as notas duráveis entraram' },
    { kind: 'conhecimento', title: 'Chaveiro corta em 128', text: 'security -w sem valor trunca o segredo' },
  ]))) {
    capture({ ...proposal, day: DAY })
  }

  assert.deepEqual(listNotes('project'), ['Hipocampo'])
  assert.deepEqual(listNotes('knowledge'), ['Chaveiro corta em 128'])
  const note = fs.readFileSync(path.join(root, '20 Projetos', 'Hipocampo.md'), 'utf8')
  assert.match(note, /- \*\*2026-09-21\*\* — as notas duráveis entraram/)
})
