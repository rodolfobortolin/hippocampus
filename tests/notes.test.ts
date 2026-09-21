import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

process.env.HIPPOCAMPUS_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'hippocampus-notes-'))

const { config } = await import('../core/config.ts')
const { capture, folderFor, listNotes, noteFolders, appendUnder } = await import('../core/notes.ts')

/**
 * These notes are the person's, written over months. Everything here is about
 * adding a line without disturbing what is already in the note — and about
 * never inventing a second folder for a vault that already has one.
 */

function vault(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hippocampus-vault-'))
  config.vault = root
  return root
}

const read = (file: string) => fs.readFileSync(file, 'utf8')

test('a vault in Portuguese keeps its folders even with the app in English', () => {
  const root = vault()
  config.lang = 'en-US'
  fs.mkdirSync(path.join(root, '20 Projetos'))
  fs.mkdirSync(path.join(root, '50 Pessoas'))

  assert.equal(folderFor('project'), '20 Projetos')
  assert.equal(folderFor('person'), '50 Pessoas')
  // Nothing was ever kept in "40 Knowledge", so the language decides that one.
  assert.equal(folderFor('knowledge'), '40 Knowledge')

  capture({ kind: 'project', title: 'Hippocampus', text: 'the folder feature', day: '2026-09-21' })
  assert.deepEqual(fs.readdirSync(root).sort(), ['20 Projetos', '50 Pessoas'])
})

test('no folder is created until something is written into it', () => {
  const root = vault()
  config.lang = 'en-US'
  assert.deepEqual(noteFolders().filter((f) => f.exists), [])
  assert.deepEqual(fs.readdirSync(root), [])

  capture({ kind: 'knowledge', title: 'Spring damping', text: 'bounce under 0.3', day: '2026-09-21' })
  assert.deepEqual(fs.readdirSync(root), ['40 Knowledge'])
})

test('a line joins the note that is already there, in its own dated section', () => {
  const root = vault()
  config.lang = 'pt-BR'
  const folder = path.join(root, '20 Projetos')
  fs.mkdirSync(folder)
  const file = path.join(folder, 'Atende.md')
  fs.writeFileSync(file, '---\ntipo: projeto\n---\n\n# Atende\n\n## Histórico\n\n- **2026-09-01** — começou\n\n## Links\n\n- [[Cliente]]\n')

  const saved = capture({ kind: 'project', title: 'Atende', text: 'fila de mensagens refeita', day: '2026-09-21' })
  assert.equal(saved.created, false)
  assert.equal(saved.file, file)

  const text = read(file)
  assert.match(text, /- \*\*2026-09-21\*\* — fila de mensagens refeita/)
  // The line goes at the end of its section, not at the end of the note.
  assert.ok(text.indexOf('fila de mensagens') < text.indexOf('## Links'))
  assert.ok(text.includes('- **2026-09-01** — começou'), 'what was there stays')
  assert.equal((text.match(/^## Histórico/gm) ?? []).length, 1)
})

test('a note keeps the heading it was born with when the language changes', () => {
  const root = vault()
  const folder = path.join(root, '50 Pessoas')
  fs.mkdirSync(folder)
  fs.writeFileSync(path.join(folder, 'Ana.md'), '# Ana\n\n## Interações\n\n- **2026-08-02** — café\n')

  config.lang = 'en-US'
  const saved = capture({ kind: 'person', title: 'Ana', text: 'talked about the migration', day: '2026-09-21' })

  assert.equal(saved.section, 'Interações')
  const text = read(saved.file)
  assert.ok(!text.includes('## Interactions'), 'no second section in the new language')
  assert.match(text, /- \*\*2026-09-21\*\* — talked about the migration/)
})

test('a new note is born from the vault template, filled in', () => {
  const root = vault()
  config.lang = 'pt-BR'
  fs.mkdirSync(path.join(root, '90 Templates'))
  fs.writeFileSync(path.join(root, '90 Templates', 'Projeto.md'),
    '---\ntipo: projeto\ncriado: {{date}}\n---\n\n# {{title}}\n\n## Histórico\n\n## Links\n')

  const saved = capture({ kind: 'project', title: 'Hipocampo', text: 'nasceu hoje', day: '2026-09-21' })
  assert.equal(saved.created, true)

  const text = read(saved.file)
  assert.match(text, /criado: 2026-09-21/)
  assert.match(text, /# Hipocampo/)
  assert.ok(!text.includes('{{'), 'no placeholder survives')
  assert.ok(text.indexOf('nasceu hoje') < text.indexOf('## Links'), 'it lands in the first section')
})

test('a new note fills the first section its template opens', () => {
  const root = vault()
  config.lang = 'pt-BR'
  fs.mkdirSync(path.join(root, '90 Templates'))
  fs.writeFileSync(path.join(root, '90 Templates', 'Conhecimento.md'),
    '---\ntipo: conhecimento\n---\n\n# {{title}}\n\n## Resumo\n\n## Detalhes\n\n## Links\n')

  const saved = capture({ kind: 'knowledge', title: 'Chaveiro corta em 128', text: 'security -w trunca o segredo', day: '2026-09-21' })
  assert.equal(saved.section, 'Resumo')
  const text = read(saved.file)
  assert.ok(text.indexOf('security -w') < text.indexOf('## Detalhes'), 'the summary is not left empty')
})

test('a capture never lands inside the block the journal owns', () => {
  const root = vault()
  config.lang = 'pt-BR'
  const folder = path.join(root, '30 Áreas')
  fs.mkdirSync(folder)
  const file = path.join(folder, 'Saúde.md')
  fs.writeFileSync(file,
    '# Saúde\n\n## Notas\n\n- caminhada\n\n<!-- hippocampus:start -->\n\nmedido pelo app\n\n<!-- hippocampus:end -->\n\n## Links\n\n- [[Corrida]]\n')

  capture({ kind: 'area', title: 'Saúde', text: 'dormir antes da meia-noite', day: '2026-09-21' })

  const text = read(file)
  const ours = text.indexOf('<!-- hippocampus:start -->')
  const closes = text.indexOf('<!-- hippocampus:end -->')
  const mine = text.indexOf('dormir antes da meia-noite')
  assert.ok(mine > closes || mine < ours, 'the line is outside our markers')
  assert.match(text, /medido pelo app/)
})

test('a title never escapes its folder', () => {
  const root = vault()
  config.lang = 'en-US'
  const saved = capture({ kind: 'inbox', title: '../../etc/passwd', text: 'nope', day: '2026-09-21' })
  assert.ok(saved.file.startsWith(path.join(root, '00 Inbox')), saved.file)
  assert.ok(!saved.file.includes('..'))
})

test('the inbox is a note with no section, and the list comes back sorted', () => {
  const root = vault()
  config.lang = 'en-US'
  capture({ kind: 'inbox', title: 'Ask about the notarisation', text: 'the password is his to type', day: '2026-09-21' })
  capture({ kind: 'inbox', title: 'A second thought', text: 'later', day: '2026-09-21' })

  assert.deepEqual(listNotes('inbox'), ['A second thought', 'Ask about the notarisation'])
  const text = read(path.join(root, '00 Inbox', 'A second thought.md'))
  assert.match(text, /type: inbox/)
  assert.ok(!text.includes('##'), 'nothing invents a section for a loose thought')
})

test('a note born in a Portuguese vault is written in Portuguese', () => {
  const root = vault()
  config.lang = 'pt-BR'
  const saved = capture({ kind: 'knowledge', title: 'TCC congela disco', text: 'para o processo, sem erro', day: '2026-09-21' })
  const text = read(saved.file)
  assert.match(text, /^---\ntipo: conhecimento\ncriado: 2026-09-21\n---/)
  // And the line under the heading is separated from it, as a note is written.
  assert.match(text, /## Detalhes\n\npara o processo/)
})

test('an empty section opens with a blank line, a list stays tight', () => {
  const opened = appendUnder('# A\n\n## Histórico\n\n## Links\n', 'Histórico', '- **2026-09-21** — primeira')
  assert.match(opened, /## Histórico\n\n- \*\*2026-09-21\*\*/)
  const second = appendUnder(opened, 'Histórico', '- **2026-09-22** — segunda')
  assert.match(second, /primeira\n- \*\*2026-09-22\*\*/)
})

test('a heading that is not there yet is opened at the end', () => {
  const text = appendUnder('# A\n\n## One\n\n- a line\n', 'Two', '- another')
  assert.match(text, /## Two\n\n- another\n$/)
  assert.match(text, /- a line/)
})
