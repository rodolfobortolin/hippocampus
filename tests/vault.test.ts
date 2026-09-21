import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

process.env.HIPPOCAMPUS_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'hippocampus-vault-'))

const { config } = await import('../core/config.ts')
const { replaceSection, writeDaySection } = await import('../core/vault.ts')

/**
 * The note belongs to the person, and to whatever else writes in it. Other
 * tools read a note by its headings, so ours has to look like a section to
 * them: heading first, markers inside it.
 */

const DAY = '2026-09-20'
const note = (body: string) => `---\ntipo: diário\n---\n\n# ${DAY}\n\n## Log\n\n- 09:00 · something\n\n## Captures\n\n- [[A note]]\n${body}`

test('the heading is part of the block, so writing twice leaves one of it', () => {
  const once = replaceSection(note(''), 'measured', 'On the computer')
  const twice = replaceSection(once, 'measured again', 'On the computer')
  assert.equal((twice.match(/^## On the computer/gm) ?? []).length, 1)
  assert.equal((twice.match(/hippocampus:start/g) ?? []).length, 1)
  assert.ok(twice.includes('measured again') && !twice.includes('>measured<'))
  // And the heading really does come before the marker.
  assert.match(twice, /## On the computer\n\n<!-- hippocampus:start -->/)
})

test('a note written under the old shape is converted, not doubled', () => {
  // Before, the marker sat above the heading — which is what let another tool
  // write inside our block.
  const old = note('\n<!-- hipocampo:início -->\n\n## No computador\n\nthe old day\n\n<!-- hipocampo:fim -->\n')
  const now = replaceSection(old, 'the new day', 'No computador')
  assert.equal((now.match(/^## No computador/gm) ?? []).length, 1)
  assert.ok(!now.includes('hipocampo:início'), 'the old markers are gone')
  assert.ok(!now.includes('the old day') && now.includes('the new day'))
  assert.match(now, /## No computador\n\n<!-- hippocampus:start -->/)
})

test('what another tool wrote in the section above ours stays there', () => {
  const written = replaceSection(note(''), 'measured', 'On the computer')
  // The Obsidian plugin appends to its own last section, just above ours.
  const withCapture = written.replace('- [[A note]]\n', '- [[A note]]\n- [[Captured later]]\n')
  const again = replaceSection(withCapture, 'measured again', 'On the computer')
  assert.ok(again.includes('[[Captured later]]'), 'the capture survived our next write')
  assert.match(again, /## Captures[\s\S]*\[\[Captured later\]\][\s\S]*## On the computer/)
})

test('a day nobody has written yet is born from the vault\'s own template', () => {
  const vault = fs.mkdtempSync(path.join(os.tmpdir(), 'hippocampus-obsidian-'))
  fs.mkdirSync(path.join(vault, '.obsidian'), { recursive: true })
  fs.mkdirSync(path.join(vault, '90 Templates'), { recursive: true })
  fs.writeFileSync(path.join(vault, '.obsidian', 'daily-notes.json'),
    JSON.stringify({ folder: 'Journal', format: 'YYYY-MM-DD', template: '90 Templates/Daily' }))
  fs.writeFileSync(path.join(vault, '90 Templates', 'Daily.md'),
    '---\ntipo: diário\ndata: {{date}}\ntags: [diário]\n---\n# {{title}}\n\n## Log\n')
  config.vault = vault
  config.journalFolder = 'Journal'

  const file = writeDaySection(DAY, 'measured', 'No computador')
  assert.ok(file)
  const text = fs.readFileSync(file, 'utf8')
  assert.match(text, /^---\ntipo: diário\ndata: 2026-09-20\ntags: \[diário\]\n---/, 'the properties the vault uses')
  assert.ok(text.includes('## Log'), 'the headings the template has')
  assert.match(text, /## No computador\n\n<!-- hippocampus:start -->\n\nmeasured/)
})

test('a heading that is not ours is never taken with the block', () => {
  // Under the old shape the marker sat below the previous section's heading.
  // With that section empty, the heading is the line right above ours — and
  // an empty "Captures" was deleted from a real note this way.
  const old = `---\ntipo: diário\n---\n\n# ${DAY}\n\n## Log\n\n- 09:00 · something\n\n## Capturas\n\n<!-- hipocampo:início -->\n\n## No computador\n\nthe old day\n\n<!-- hipocampo:fim -->\n`
  const now = replaceSection(old, 'the new day', 'No computador')
  assert.match(now, /^## Capturas$/m, 'the empty section above ours is still there')
  assert.equal((now.match(/^## No computador/gm) ?? []).length, 1)
  assert.match(now, /## Capturas\n\n## No computador\n\n<!-- hippocampus:start -->/)
})
