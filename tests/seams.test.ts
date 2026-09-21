import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * The seams between the parts, checked by name.
 *
 * Nothing here tests behaviour. Every one of these guards a place where two
 * files agree on a *string* and nothing in the compiler knows it: the core
 * sends `type: 'delta'` and the screen looks for `data.type === 'delta'`; the
 * helper writes `"sound"` and the collector reads `sample.sound`; a button asks
 * for the class `icon` and the stylesheet defines `.icon`.
 *
 * Every one of these seams has already broken in silence at least once — the
 * app compiled, the tests passed, and the chat simply stopped answering while
 * the database quietly stored nulls. A typecheck cannot see across a string, so
 * the strings get read on both sides here instead.
 */

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

function filesUnder(dir: string, extensions: string[]): string[] {
  const here = path.join(root, dir)
  if (!fs.existsSync(here)) return []
  return fs.readdirSync(here, { withFileTypes: true }).flatMap((entry) => {
    const relative = path.join(dir, entry.name)
    if (entry.isDirectory()) return filesUnder(relative, extensions)
    return extensions.some((e) => entry.name.endsWith(e)) ? [relative] : []
  })
}

const screens = ['src/components/Chat.tsx', 'src/FloatingCore.tsx']

test('every event the screens listen for is one the core sends', () => {
  const server = read('core/server.ts')
  const sent = new Set([...server.matchAll(
    /(?:send|broadcast|toThisScreen|wake\?\.)\(\{\s*type:\s*'([\w-]+)'/g)].map((m) => m[1]))
  assert.ok(sent.size > 4, 'the core should send several kinds of event')

  for (const file of screens) {
    const source = read(file)
    const heard = new Set<string>()
    for (const [, name] of source.matchAll(/data\.type === '([\w-]+)'/g)) {
      assert.ok(sent.has(name), `${file} waits for "${name}", which the core never sends`)
      heard.add(name)
    }
    // Reading the right name off the wrong key is the same silence as reading
    // the wrong name, and a regex over the names alone cannot tell them apart:
    // a screen that looks at `data.tipo` matches nothing and passes. So each
    // screen has to be caught handling the answer, the end of it, and a failure.
    for (const required of ['delta', 'end', 'error']) {
      assert.ok(heard.has(required),
        `${file} never handles "${required}" — is it reading a key other than data.type?`)
    }
  }
})

test('every message the screens send is one the core answers', () => {
  const server = read('core/server.ts')
  const accepted = new Set([...server.matchAll(/payload\.type (?:===|!==) '([\w-]+)'/g)].map((m) => m[1]))

  for (const file of screens) {
    const source = read(file)
    for (const [, name] of source.matchAll(/\{\s*type:\s*'([\w-]+)'(?:,\s*(?:text|sdp))/g)) {
      assert.ok(accepted.has(name),
        `${file} sends "${name}", which the core drops on the floor`)
    }
  }
})

test('every class the interface asks for exists in the stylesheet', () => {
  const css = read('src/styles.css')
  const defined = new Set([...css.matchAll(/\.([A-Za-z][\w-]*)/g)].map((m) => m[1]))
  // Written by hand rather than in a class attribute, or applied by a library.
  const elsewhere = new Set(['floating', 'core'])

  for (const file of filesUnder('src', ['.tsx'])) {
    const source = read(file)
    for (const match of source.matchAll(/className=(?:\{`([^`]*)`\}|"([^"]*)")/g)) {
      const literal = (match[1] ?? match[2] ?? '')
      // A `${...}` chooses between class names; both sides have to exist.
      const names = [
        ...literal.replace(/\$\{[^}]*\}/g, ' ').split(/\s+/),
        ...[...literal.matchAll(/\$\{[^}]*\}/g)].flatMap((m) =>
          [...m[0].matchAll(/[?:]\s*'([a-z0-9 -]*)'/g)].flatMap((q) => q[1].split(/\s+/))),
      ]
      for (const name of names) {
        if (!name || elsewhere.has(name)) continue
        assert.ok(defined.has(name),
          `${file} uses the class "${name}", which ${'src/styles.css'} does not define`)
      }
    }
  }
})

test('every channel the bridge invokes is one the shell answers', () => {
  const preload = read('app/preload.cjs')
  const main = read('app/main.cjs')
  const handled = new Set([
    ...[...main.matchAll(/ipcMain\.handle\('([\w:-]+)'/g)].map((m) => m[1]),
    ...[...main.matchAll(/ipcMain\.on\('([\w:-]+)'/g)].map((m) => m[1]),
  ])
  const called = [
    ...[...preload.matchAll(/ipcRenderer\.invoke\('([\w:-]+)'/g)].map((m) => m[1]),
    ...[...preload.matchAll(/ipcRenderer\.send\('([\w:-]+)'/g)].map((m) => m[1]),
  ]
  assert.ok(called.length > 3, 'the bridge should expose several channels')
  for (const channel of called) {
    assert.ok(handled.has(channel),
      `the bridge invokes "${channel}", which app/main.cjs does not handle`)
  }
})

test('the shell asks the registrar for commands it understands', () => {
  const swift = read('native/agents.swift')
  const main = read('app/main.cjs')
  const known = new Set([...swift.matchAll(/case "(\w+)":/g)].map((m) => m[1]))
  assert.ok(known.size >= 3, 'the registrar should take several commands')
  for (const [, command] of main.matchAll(/agents\('(\w+)'\)/g)) {
    assert.ok(known.has(command),
      `the shell calls the registrar with "${command}", which it does not know`)
  }
})

test('the fields the helper writes are the ones the collector reads', () => {
  const swift = read('native/focus.swift')
  // The helper writes NDJSON by hand: `"name":value` and field("name", …).
  const written = new Set([
    ...[...swift.matchAll(/\\"(\w+)\\":/g)].map((m) => m[1]),
    ...[...swift.matchAll(/field\("(\w+)"/g)].map((m) => m[1]),
  ])
  assert.ok(written.size > 10, `the helper should write many fields, found ${written.size}`)

  const source = read('core/sources/focus.ts')
  const start = source.indexOf('type Sample = {')
  const shape = source.slice(start, source.indexOf('\n}', start))
  const expected = [...shape.matchAll(/^ {2}(\w+)\??:/gm)].map((m) => m[1])
  assert.ok(expected.length > 10, 'the collector should expect many fields')

  for (const field of expected) {
    assert.ok(written.has(field),
      `the collector reads "${field}", which native/focus.swift never writes`)
  }
})

test('the helper posts to a route the core actually serves', () => {
  const server = read('core/server.ts')
  const served = new Set([...server.matchAll(/route === '(\/api\/[\w/-]+)'/g)].map((m) => m[1]))

  for (const file of ['scripts/agent.sh', 'scripts/listener.sh', 'scripts/launch-focus.sh',
                      'scripts/launch-listener.sh', 'native/listener.swift']) {
    const source = read(file)
    for (const [, route] of source.matchAll(/http:\/\/127\.0\.0\.1:\d+(\/api\/[\w/-]+)/g)) {
      assert.ok(served.has(route),
        `${file} posts to ${route}, which the core does not serve`)
    }
  }
})

test('the helper bundles ship the icon their plist asks for', () => {
  for (const plist of ['native/Info.plist', 'native/InfoListener.plist']) {
    const asked = read(plist).match(/<key>CFBundleIconFile<\/key>\s*<string>([\w.-]+)<\/string>/)
    if (!asked) continue
    const name = asked[1].endsWith('.icns') ? asked[1] : `${asked[1]}.icns`
    const built = read('scripts/build-native.sh')
    assert.ok(built.includes(name),
      `${plist} asks for ${name}, which scripts/build-native.sh never copies in`)
  }
})

test('the day report carries every field the screen declares', async () => {
  // The screen's `Day` type is a promise about the JSON, and nothing checks it:
  // the core renamed `input` to `entry` once and the whole Today screen went
  // black, with a green typecheck and green tests.
  const { dayReport } = await import('../core/metrics.ts')
  const { today } = await import('../core/config.ts')
  const report = dayReport(today()) as Record<string, unknown>

  const api = read('src/lib/api.ts')
  const start = api.indexOf('export type Day = {')
  const shape = api.slice(start, api.indexOf('\n}', start))
  const declared = [...shape.matchAll(/^ {2}(\w+)\??:/gm)].map((m) => m[1])
  assert.ok(declared.length > 15, `the Day type should declare many fields, found ${declared.length}`)

  for (const field of declared) {
    assert.ok(field in report,
      `src/lib/api.ts declares Day.${field}, which core/metrics.ts never returns`)
  }
})

test('every command the README tells you to run exists', () => {
  const scripts = Object.keys(JSON.parse(read('package.json')).scripts)
  for (const file of ['README.md', 'README.pt-BR.md', 'CONTRIBUTING.md', 'CLAUDE.md']) {
    if (!fs.existsSync(path.join(root, file))) continue
    for (const [, name] of read(file).matchAll(/npm run ([\w:]+)/g)) {
      assert.ok(scripts.includes(name),
        `${file} says to run "npm run ${name}", which package.json does not define`)
    }
  }
})

test('the flags the README shows on our own commands are flags the code reads', () => {
  // Only the flags on an `npm run` line: the rest belong to xcrun, codesign and
  // the other tools the docs walk through, and are not ours to rename.
  const docs = ['README.md', 'README.pt-BR.md']
    .filter((file) => fs.existsSync(path.join(root, file)))
    .map(read).join('\n')
  const code = ['core/rollup.ts', 'core/backfill.ts', 'core/index.ts',
                'native/focus.swift', 'native/listener.swift', 'native/agents.swift']
    .filter((file) => fs.existsSync(path.join(root, file)))
    .map(read).join('\n')

  for (const [line] of docs.matchAll(/^.*npm run .*$/gm)) {
    for (const [, flag] of line.matchAll(/\s(--[a-z][\w-]*)/g)) {
      if (['--mac', '--arm64', '--experimental-strip-types', '--test'].includes(flag)) continue
      assert.ok(code.includes(`'${flag}'`) || code.includes(`"${flag}"`),
        `the docs show "${flag}" on an npm run line, which nothing in this repository reads`)
    }
  }
})

test('the core avoids TypeScript that Node can only strip, not compile', () => {
  // The core runs under `--experimental-strip-types`, which deletes types and
  // compiles nothing. Anything that has to emit code — a parameter property, an
  // enum, a namespace — typechecks cleanly and then throws at import time, and
  // the whole app comes up empty because the core never started.
  const forbidden: [RegExp, string][] = [
    [/constructor\s*\([^)]*\b(private|public|protected|readonly)\s+\w+/s, 'a parameter property'],
    [/^\s*(?:export\s+)?enum\s+\w+/m, 'an enum'],
    [/^\s*(?:export\s+)?namespace\s+\w+/m, 'a namespace'],
  ]
  for (const file of filesUnder('core', ['.ts'])) {
    const source = read(file)
    for (const [pattern, what] of forbidden) {
      assert.ok(!pattern.test(source),
        `${file} uses ${what}, which Node's strip-only mode throws on at import`)
    }
  }
})

test('a journal section written under the old name is replaced, not duplicated', async () => {
  // The markers are Portuguese strings sitting in notes people already have.
  // A rename reaching into them is silent: the section stops being found and
  // the next write leaves two of them in the file.
  const { replaceSection } = await import('../core/vault.ts')
  const before = [
    '# 2026-09-19',
    '',
    '<!-- hipocampo:início -->',
    '## What the machine saw',
    'the old text',
    '<!-- hipocampo:fim -->',
    '',
    'notes of my own, below',
  ].join('\n')

  const after = replaceSection(before, 'the new text', '## What the machine saw')
  assert.equal((after.match(/What the machine saw/g) ?? []).length, 1,
    'the old section should be replaced, not joined by a second one')
  assert.ok(after.includes('the new text'), 'the new text should be in there')
  assert.ok(!after.includes('the old text'), 'the old text should be gone')
  assert.ok(after.includes('notes of my own, below'), 'what the person wrote must survive')
})

test('no screen decides how to listen before it knows the mode', () => {
  // The shortcut creates the floating window and tells it to wake on the same
  // breath, so the first wake can land before /api/settings has answered.
  // Acting then means guessing the mode, and guessing wrong opens the
  // microphone twice: the recorder now, the live session on the next press.
  for (const file of screens) {
    const source = read(file)
    for (const [call] of source.matchAll(/^.*listening\.toggle\(\).*$/gm)) {
      // The line itself, or the branch it sits in, has to know about live mode.
      const at = source.indexOf(call)
      const around = source.slice(Math.max(0, at - 700), at)
      assert.ok(/liveWanted|liveOn|voiceMode/.test(around),
        `${file} starts the recorder at "${call.trim()}" without checking the voice mode`)
    }
  }
})

test('a permission is only reported missing once the helper has said so', () => {
  // Starting the flag at false means "not told yet" reads as "denied", so the
  // app put up a warning about a missing permission every time it opened and
  // took it back when the first sample landed. A warning that retracts itself
  // teaches people to ignore warnings.
  const focus = read('core/sources/focus.ts')
  assert.ok(/trusted:\s*boolean \| null = null/.test(focus),
    'core/sources/focus.ts should start `trusted` as null, not false')

  // And the screens have to test against false, never truthiness.
  for (const file of ['src/components/Today.tsx', 'src/App.tsx']) {
    for (const [line] of read(file).matchAll(/^.*collector\.trusted.*$/gm)) {
      assert.ok(/trusted === (true|false)/.test(line),
        `${file} reads collector.trusted as a boolean at "${line.trim()}" — unknown is not denied`)
    }
  }
})

test('the wider tools are off until asked for', async () => {
  // Turning them on lets the assistant act on the machine without stopping to
  // ask, and lets what it looks at leave. That is a decision, so it cannot be
  // the default, and it cannot arrive through a settings file that predates it.
  const { readSettings } = await import('../core/settings.ts')
  const defaults = read('core/settings.ts')
  assert.ok(/wideTools:\s*false/.test(defaults),
    'core/settings.ts should default wideTools to false')
  assert.ok(/wideTools:\s*data\.wideTools === true/.test(defaults),
    'anything other than an explicit true must read as off')
  assert.equal(typeof readSettings().wideTools, 'boolean')

  // And the gate itself: the allowlist is only dropped when the flag is on.
  const agent = read('core/agent.ts')
  assert.ok(/wide \? \{\} : \{ allowedTools:/.test(agent),
    'core/agent.ts should keep the allowlist unless wideTools is on')
})
