// Generates the website's voice, one file per line of site/tour-script.ts —
// the tour and the greeting — into site/public/voice/. Run it after changing the script:
//
//   node --experimental-strip-types scripts/site-voice.ts          every line
//   node --experimental-strip-types scripts/site-voice.ts hello    only the lines named
//
// The key is read from the Keychain, as the app reads it — never from an
// argument. The files are committed, so the page calls no voice API and a
// visitor's browser never meets the key.

import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readKey, openaiBase } from '../core/settings.ts'
import { GREETING, TOUR } from '../site/tour-script.ts'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const out = path.join(root, 'site', 'public', 'voice')
const VOICE = process.env.TOUR_VOICE || 'marin'

const key = readKey('openai') || process.env.OPENAI_API_KEY
if (!key) throw new Error('No OpenAI key in the Keychain; add it in the app\'s Settings first.')
await mkdir(out, { recursive: true })

// Every line the page can say: the tour, and the greeting a click on the sphere starts.
const LINES = [...TOUR, GREETING.ask, GREETING.later, GREETING.yes]
const only = process.argv.slice(2)
for (const step of LINES.filter((step) => !only.length || only.includes(step.id))) {
  // The region the app's Settings chose: a key from an EU project is refused
  // at the global address.
  const response = await fetch(`${openaiBase()}/audio/speech`, {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini-tts',
      voice: VOICE,
      input: step.text,
      instructions: 'Warm, calm and natural, like a friend showing you around something they made. Unhurried, never salesy.',
      response_format: 'mp3',
    }),
  })
  if (!response.ok) throw new Error(`${step.id}: ${response.status} ${(await response.text()).slice(0, 200)}`)
  const audio = Buffer.from(await response.arrayBuffer())
  await writeFile(path.join(out, `${step.id}.mp3`), audio)
  console.log(`${step.id}.mp3 · ${Math.round(audio.length / 1024)} KB`)
}
