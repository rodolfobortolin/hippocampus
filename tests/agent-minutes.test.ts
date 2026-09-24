import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// A home and a database of their own, set before anything imports the core:
// the harvester reads ~/.claude/projects, and this must never be the real one.
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'hippocampus-home-'))
const data = fs.mkdtempSync(path.join(os.tmpdir(), 'hippocampus-agents-'))
process.env.HOME = home
process.env.HIPPOCAMPUS_DATA = data

const { db } = await import('../core/db.ts')
const { config } = await import('../core/config.ts')
// The code folder this machine's .env may name is not the one these sessions
// live in; the test decides it.
config.codeRoots = [path.join(home, 'Documents', 'GitHub')]
const { harvestClaudeSessions } = await import('../core/sources/ai.ts')

const at = (clock: string) => new Date(`2026-09-17T${clock}-03:00`).toISOString()
const human = (clock: string, text: string, cwd: string) =>
  ({ type: 'user', origin: { kind: 'human' }, uuid: `u-${clock}`, cwd, timestamp: at(clock), message: { content: text } })
const toolResult = (clock: string, cwd: string) =>
  ({ type: 'user', cwd, timestamp: at(clock), message: { content: [{ type: 'tool_result', content: 'ok' }] } })
const interrupted = (clock: string, cwd: string) =>
  ({ type: 'user', cwd, timestamp: at(clock), message: { content: [{ type: 'text', text: '[Request interrupted by user]' }] } })
const assistant = (clock: string, stop: 'tool_use' | 'end_turn', cwd: string) =>
  ({ type: 'assistant', cwd, timestamp: at(clock), message: { stop_reason: stop, content: [{ type: 'text', text: '…' }] } })
const edits = (clock: string, file: string, cwd: string) =>
  ({ type: 'assistant', cwd, timestamp: at(clock), message: { stop_reason: 'tool_use', content: [
    { type: 'tool_use', name: 'Edit', input: { file_path: file, old_string: 'a', new_string: 'b' } }] } })
const reads = (clock: string, file: string, cwd: string) =>
  ({ type: 'assistant', cwd, timestamp: at(clock), message: { stop_reason: 'tool_use', content: [
    { type: 'tool_use', name: 'Read', input: { file_path: file } }] } })

function session(folder: string, name: string, events: object[]) {
  const dir = path.join(home, '.claude', 'projects', folder)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, `${name}.jsonl`), events.map((e) => JSON.stringify(e)).join('\n') + '\n')
}

const minutes = (project: string) => (db.prepare(
  `select strftime('%H:%M', minute * 60, 'unixepoch', '-03:00') at from agent_minutes where project = ? order by minute`,
).all(project) as { at: string }[]).map((row) => row.at)

test('an agent works through a turn, tools running included, and not while it waits for you', async () => {
  const cwd = '/work/harbor'
  session('-work-harbor', 's1', [
    human('10:00:00', 'paginate the orders endpoint', cwd),
    assistant('10:00:05', 'tool_use', cwd),
    // The tests take four minutes, and nothing is written while they run.
    toolResult('10:04:10', cwd),
    assistant('10:05:00', 'end_turn', cwd),
    // Twenty-five minutes waiting for the person: not work.
    human('10:30:00', 'and the last page?', cwd),
    assistant('10:30:20', 'end_turn', cwd),
  ])
  await harvestClaudeSessions()
  assert.deepEqual(minutes('harbor'), ['10:00', '10:01', '10:02', '10:03', '10:04', '10:05', '10:30'])
})

test('a turn stopped by the person stops counting, and a gap too long is not filled', async () => {
  const cwd = '/work/atlas'
  session('-work-atlas', 's2', [
    human('11:00:00', 'refactor the checkout', cwd),
    assistant('11:00:10', 'tool_use', cwd),
    interrupted('11:01:00', cwd),
    human('11:10:00', 'try again', cwd),
    assistant('11:10:05', 'tool_use', cwd),
    // Forty minutes with nothing: the session died or the Mac slept.
    toolResult('11:50:00', cwd),
    assistant('11:50:10', 'end_turn', cwd),
  ])
  await harvestClaudeSessions()
  assert.deepEqual(minutes('atlas'), ['11:00', '11:01', '11:10', '11:50'])
})

test('the app writing its own journal is not the person delegating', async () => {
  // A session whose folder holds a hippocampus.db was started by the app.
  session('-hippocampus-data', 's3', [
    human('12:00:00', 'Write the day…', data),
    assistant('12:02:00', 'end_turn', data),
  ])
  await harvestClaudeSessions()
  assert.deepEqual(minutes(path.basename(data)), [])
  assert.equal((db.prepare('select count(*) n from ai_turns where project = ?').get(path.basename(data)) as { n: number }).n, 0)
})

test('a turn that spans two readings is filled across them', async () => {
  const cwd = '/work/ledger'
  const file = path.join(home, '.claude', 'projects', '-work-ledger', 's4.jsonl')
  session('-work-ledger', 's4', [human('13:00:00', 'reconcile', cwd), assistant('13:00:05', 'tool_use', cwd)])
  await harvestClaudeSessions()
  // The rest of the turn is written after the first reading.
  fs.appendFileSync(file, [toolResult('13:03:00', cwd), assistant('13:03:30', 'end_turn', cwd)].map((e) => JSON.stringify(e)).join('\n') + '\n')
  await harvestClaudeSessions()
  assert.deepEqual(minutes('ledger'), ['13:00', '13:01', '13:02', '13:03'])
})

test('the minute a question is asked is the agent’s, even when the answer starts in the next', async () => {
  const cwd = '/work/quay'
  session('-work-quay', 's8', [
    human('17:00:40', 'rename the column', cwd),
    assistant('17:01:10', 'end_turn', cwd),
  ])
  await harvestClaudeSessions()
  assert.deepEqual(minutes('quay'), ['17:00', '17:01'])
})

const code = path.join(home, 'Documents', 'GitHub')
const prompts = (project: string | null) => (db.prepare(
  `select prompt from ai_turns where ${project === null ? 'project is null' : 'project = ?'} order by ts`,
).all(...(project === null ? [] : [project])) as { prompt: string }[]).map((row) => row.prompt)

test('the work belongs to the repository the agent wrote into, not to the folder it was opened in', async () => {
  // Opened in jarvis, spent the afternoon on hippocampus.
  const cwd = path.join(code, 'jarvis')
  session('-Users-x-Documents-GitHub-jarvis', 's5', [
    human('14:00:00', 'fix the vault heading in hippocampus', cwd),
    // Reading another project is a reference, not a move.
    reads('14:00:20', path.join(code, 'speakly', 'README.md'), cwd),
    edits('14:02:00', path.join(code, 'hippocampus', 'core', 'vault.ts'), cwd),
    assistant('14:04:00', 'end_turn', cwd),
    // A later question with no file in it is still about that work.
    human('14:10:00', 'and the tests?', cwd),
    assistant('14:11:00', 'end_turn', cwd),
  ])
  await harvestClaudeSessions()

  // The minute leading up to the write was spent on what was about to be written.
  assert.deepEqual(minutes('jarvis'), ['14:00'], 'only the minute before the work moved')
  assert.deepEqual(minutes('hippocampus'), ['14:01', '14:02', '14:03', '14:04', '14:10', '14:11'])
  assert.deepEqual(minutes('speakly'), [])
  assert.deepEqual(prompts('hippocampus'), ['fix the vault heading in hippocampus', 'and the tests?'])
})

test('a subfolder is its repository, and the home folder is no project', async () => {
  session('-Users-x-Documents-GitHub-portal-src', 's6', [
    human('15:00:00', 'why does the build fail', path.join(code, 'portal', 'src')),
    assistant('15:00:30', 'end_turn', path.join(code, 'portal', 'src')),
  ])
  session('-Users-x', 's7', [
    human('16:00:00', 'what is on my calendar', home),
    assistant('16:00:30', 'end_turn', home),
  ])
  await harvestClaudeSessions()

  assert.deepEqual(prompts('portal'), ['why does the build fail'])
  assert.deepEqual(prompts('src'), [])
  assert.deepEqual(prompts(null), ['what is on my calendar'])
  assert.deepEqual(prompts(path.basename(home)), [])
})
