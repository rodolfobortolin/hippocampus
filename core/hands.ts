// The fast hands: on-screen actions through Groq, when turned on in Settings.
//
// Claude Code answers every request with a fresh agent session: three to five
// seconds to start, one to nine seconds a turn, four more to finish. For "click
// Play" or "open Calculator and do 12 × 7" that is most of a minute. A model
// on Groq answers a tool call in about half a second, and the controls come as
// text from Accessibility rather than as a screenshot, so a step costs about a
// second in all.
//
// It is only hands. Anything that is not an action on the screen — a question
// about the day, a summary, anything that needs the database — is handed back
// to Claude Code at once, and the person never sees the difference.

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { config } from './config.ts'
import { LANGUAGES, validLanguage } from './languages.ts'
import { listControls, pressControl, NoAccessibility, type Controls } from './screen.ts'

const run = promisify(execFile)
const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'
const MODEL = process.env.HIPPOCAMPUS_HANDS_MODEL || 'openai/gpt-oss-120b'
/** A task that needs more than this is not a quick one; Claude Code takes it. */
const MAX_STEPS = 14
/** Listing the whole tree of a busy window can run to hundreds; the model reads them all, so keep it bounded. */
const MAX_CONTROLS = 220

export const handsAvailable = () => Boolean(config.groqKey)

const SYSTEM = (language: string) => `You are the hands of Hippocampus on this Mac. You do what the person asks on their screen, fast, with these tools:
- open_app: open or bring an app to the front, by its name.
- controls: list the controls (buttons, rows, tabs, fields…) of the window on top, or of the app named, each with a number.
- press: press a control by its number from the latest controls list.
- read: read the text the window shows — a result on a display, a status, a title.
- hand_off: give the request to the other assistant.

Rules:
- Only if the request has nothing to do with the screen — a question about the person's day, time, work or projects, a summary, writing — call hand_off, before anything else.
- Reading what the screen shows is part of the task: when they ask for a result, finish the actions and then call read. Never hand off for that.
- After open_app, call controls. If the controls do not show what you need after a second look, call hand_off.
- Read controls again after each press when the next step depends on what changed.
- Never press to send, buy, pay, delete, sign, accept terms or confirm anything that cannot be undone unless the person asked for exactly that.
- When done, reply with one short sentence in ${language} saying what you did and, if they asked for a result, what it is. No lists, no markdown.`

const TOOLS = [
  { type: 'function', function: {
    name: 'open_app', description: 'Open an app, or bring it to the front, by name.',
    parameters: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } } },
  { type: 'function', function: {
    name: 'controls', description: 'List the controls of the window on top, or of the app named.',
    parameters: { type: 'object', properties: { app: { type: 'string' } } } } },
  { type: 'function', function: {
    name: 'press', description: 'Press a control by its number from the latest controls list.',
    parameters: { type: 'object', properties: { index: { type: 'integer' } }, required: ['index'] } } },
  { type: 'function', function: {
    name: 'read', description: 'Read the text shown in the window on top, or in the app named.',
    parameters: { type: 'object', properties: { app: { type: 'string' } } } } },
  { type: 'function', function: {
    name: 'hand_off', description: 'This is not a quick on-screen action: give it to the other assistant.',
    parameters: { type: 'object', properties: {} } } },
]

export type HandsResult =
  | { done: true; text: string; steps: number; ms: number }
  | { done: false; reason: string }

type Message = { role: string; content?: string | null; tool_calls?: any[]; tool_call_id?: string }

async function ask(messages: Message[]): Promise<any> {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { authorization: `Bearer ${config.groqKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, messages, tools: TOOLS, tool_choice: 'auto', temperature: 0 }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) throw new Error(`Groq ${response.status}: ${(await response.text()).slice(0, 200)}`)
  return (await response.json() as any).choices?.[0]?.message
}

/**
 * Tries the request as an on-screen action. `onStep` names each step as it
 * happens, for the line under the question. A `done: false` means Claude Code
 * should answer instead — handed off, out of steps, or Groq unreachable.
 */
export async function fastHands(request: string, onStep: (name: string) => void): Promise<HandsResult> {
  if (!handsAvailable()) return { done: false, reason: 'no key' }
  const started = Date.now()
  const language = LANGUAGES[validLanguage(config.lang)].name
  const messages: Message[] = [
    { role: 'system', content: SYSTEM(language) },
    { role: 'user', content: request },
  ]
  let listed: Controls | undefined
  try {
    for (let step = 0; step < MAX_STEPS; step++) {
      const message = await ask(messages)
      if (!message) return { done: false, reason: 'no answer' }
      const calls = message.tool_calls ?? []
      if (!calls.length) {
        return { done: true, text: String(message.content ?? '').trim(), steps: step, ms: Date.now() - started }
      }
      messages.push({ role: 'assistant', content: message.content ?? null, tool_calls: calls })
      for (const call of calls) {
        const name = call.function?.name
        let args: any = {}
        try { args = JSON.parse(call.function?.arguments || '{}') } catch { /* empty arguments */ }
        if (name === 'hand_off') return { done: false, reason: 'handed off' }
        let result = ''
        if (name === 'open_app') {
          onStep(`open ${args.name}`)
          try {
            await run('/usr/bin/open', ['-a', String(args.name)], { timeout: 8_000 })
            await new Promise((resolve) => setTimeout(resolve, 600))
            result = `${args.name} is open and in front.`
          } catch {
            result = `There is no app called "${args.name}".`
          }
        } else if (name === 'controls') {
          onStep('controls')
          listed = await listControls(args.app ? String(args.app) : undefined)
          const lines = listed.controls.slice(0, MAX_CONTROLS)
            .map((control, index) => `${index} ${control.role.replace(/^AX/, '')}: ${control.label}`)
          result = `${listed.app} — ${listed.window || 'window'}\n${lines.join('\n') || '(no controls)'}`
        } else if (name === 'read') {
          onStep('read')
          const seen = await listControls(args.app ? String(args.app) : undefined, { text: true })
          const texts = seen.controls.filter((control) => control.role === 'AXStaticText').map((control) => control.label)
          result = texts.length ? texts.slice(0, 120).join('\n') : '(no text in the window)'
        } else if (name === 'press') {
          const control = listed?.controls[Number(args.index)]
          if (!listed || !control) {
            result = 'No such number in the latest controls list; list the controls first.'
          } else {
            onStep(`press ${control.label}`)
            await pressControl(listed, control)
            result = `Pressed "${control.label}".`
          }
        } else {
          result = `Unknown tool ${name}.`
        }
        messages.push({ role: 'tool', tool_call_id: call.id, content: result })
      }
    }
    return { done: false, reason: 'too many steps' }
  } catch (error) {
    // Without Accessibility the hands have nothing to press; Claude Code can
    // still look at the screen and say so.
    if (error instanceof NoAccessibility) return { done: false, reason: 'no accessibility' }
    console.error('[hands]', (error as Error).message)
    return { done: false, reason: (error as Error).message }
  }
}
