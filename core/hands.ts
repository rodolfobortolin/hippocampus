// The fast hands: on-screen actions done by Haiku, when turned on in Settings.
//
// The chat's Claude Code session loads everything on this Mac — the person's
// settings, plugins, hooks and MCP servers — and spends one to nine seconds a
// turn on the larger models: 12 × 7 on Calculator took 55 to 75 s. The hands
// run a session with none of that: no settings from disk, no built-in tools,
// only five tools of their own, on Haiku, with the controls read as text from
// Accessibility instead of a screenshot.
//
// It is only hands. Anything that is not an action on the screen — a question
// about the day, a summary, anything that needs the database — is handed back
// to the chat at once.
//
// They ran on Groq first, which was faster per step; the free tier's 8,000
// tokens a minute allowed about one task a minute, and it was one more service
// seeing what is on screen. This needs no key beyond the `claude` login.

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { query, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import { config } from './config.ts'
import { LANGUAGES, validLanguage } from './languages.ts'
import { listControls, pressControl, NoAccessibility, NoControls, type Controls } from './screen.ts'

const run = promisify(execFile)
const MODEL = process.env.HIPPOCAMPUS_HANDS_MODEL || 'claude-haiku-4-5-20251001'
/** A task that needs more than this is not a quick one; the chat takes it. */
const MAX_TURNS = 16
/** A busy window lists hundreds of controls; the model reads them all, so keep it bounded. */
const MAX_CONTROLS = 220

export const handsAvailable = () => true

const SYSTEM = (language: string) => `You are the hands of Hippocampus on this Mac. You do what the person asks on their screen, fast, with these tools:
- open_app: open or bring an app to the front, by its name.
- controls: list the controls (buttons, rows, tabs, fields…) of the window on top, or of the app named, as "Role: name".
- press: press a control by its exact name from the latest controls list.
- read: read the text the window shows — a result on a display, a status, a title.
- hand_off: give the request to the other assistant.

Rules:
- Only if the request has nothing to do with the screen — a question about the person's day, time, work or projects, a summary, writing — call hand_off, before anything else.
- Reading what the screen shows is part of the task: when they ask for a result, finish the actions and then call read. Never hand off for that.
- After open_app, call controls. If the controls do not show what you need after a second look, call hand_off.
- Read controls again after each press when the next step depends on what changed.
- Never press to send, buy, pay, delete, sign, accept terms or confirm anything that cannot be undone unless the person asked for exactly that.
- When done, reply with one short sentence in ${language} saying what you did and, if they asked for a result, what it is. No lists, no markdown.`

export type HandsResult =
  | { done: true; text: string; steps: number; ms: number }
  | { done: false; reason: string }

const say = (text: string) => ({ content: [{ type: 'text' as const, text }] })

/**
 * Tries the request as an on-screen action. `onStep` names each step as it
 * happens, for the line under the question. A `done: false` means the chat
 * should answer instead — handed off, out of turns, or something failed.
 */
export async function fastHands(request: string, onStep: (name: string) => void): Promise<HandsResult> {
  const started = Date.now()
  const language = LANGUAGES[validLanguage(config.lang)].name
  let listed: Controls | undefined
  let handedOff = false
  let steps = 0
  const stop = new AbortController()

  const server = createSdkMcpServer({
    name: 'hands',
    version: '1.0.0',
    alwaysLoad: true,
    tools: [
      {
        name: 'open_app',
        description: 'Open an app, or bring it to the front, by name.',
        inputSchema: { name: z.string() },
        handler: async ({ name }: { name: string }) => {
          steps++
          onStep(`open ${name}`)
          try {
            await run('/usr/bin/open', ['-a', name], { timeout: 8_000 })
            await new Promise((resolve) => setTimeout(resolve, 600))
            return say(`${name} is open and in front.`)
          } catch {
            return say(`There is no app called "${name}".`)
          }
        },
      },
      {
        name: 'controls',
        description: 'List the controls of the window on top, or of the app named.',
        inputSchema: { app: z.string().optional() },
        handler: async ({ app }: { app?: string }) => {
          steps++
          onStep('controls')
          listed = await listControls(app)
          // By name, not by number: with numbered lines and buttons that are
          // digits, a model pressed the index it meant as a digit.
          const lines = listed.controls.slice(0, MAX_CONTROLS)
            .map((control) => `${control.role.replace(/^AX/, '')}: ${control.label}`)
          return say(`${listed.app} — ${listed.window || 'window'}\n${lines.join('\n') || '(no controls)'}`)
        },
      },
      {
        name: 'press',
        description: 'Press a control by its exact name, as the latest controls list shows it. When several share the name, nth picks which (1 is the first).',
        inputSchema: { name: z.string(), nth: z.number().int().optional() },
        handler: async ({ name, nth }: { name: string; nth?: number }) => {
          steps++
          const wanted = name.trim().toLowerCase()
          const same = listed?.controls.filter((candidate) => candidate.label.trim().toLowerCase() === wanted) ?? []
          const control = same[Math.max(0, (nth ?? 1) - 1)] ?? same[0]
          if (!listed || !control) {
            return say(`No control called "${name}" in the latest list; list the controls first, and use a name exactly as shown.`)
          }
          onStep(`press ${control.label}`)
          try {
            await pressControl(listed, control)
            return say(`Pressed "${control.label}".`)
          } catch (error) {
            if (error instanceof NoControls) return say(`"${control.label}" changed or is gone; call controls again.`)
            throw error
          }
        },
      },
      {
        name: 'read',
        description: 'Read the text shown in the window on top, or in the app named.',
        inputSchema: { app: z.string().optional() },
        handler: async ({ app }: { app?: string }) => {
          steps++
          onStep('read')
          const seen = await listControls(app, { text: true })
          const texts = seen.controls.filter((control) => control.role === 'AXStaticText').map((control) => control.label)
          return say(texts.length ? texts.slice(0, 120).join('\n') : '(no text in the window)')
        },
      },
      {
        name: 'hand_off',
        description: 'This is not a quick on-screen action: give it to the other assistant.',
        inputSchema: {},
        handler: async () => {
          handedOff = true
          stop.abort()
          return say('Handed off.')
        },
      },
    ] as any,
  })

  const session = query({
    prompt: request,
    options: {
      model: MODEL,
      abortController: stop,
      // Isolation: none of this Mac's settings, plugins, hooks or MCP servers,
      // and none of Claude Code's own tools. Loading them is what made every
      // chat answer start several seconds late.
      settingSources: [],
      strictMcpConfig: true,
      tools: [],
      systemPrompt: SYSTEM(language),
      mcpServers: { hands: server },
      allowedTools: ['open_app', 'controls', 'press', 'read', 'hand_off'].map((name) => `mcp__hands__${name}`),
      permissionMode: 'bypassPermissions',
      maxTurns: MAX_TURNS,
      cwd: config.dataDir,
    },
  })

  try {
    for await (const message of session as any) {
      if (message.type === 'result') {
        if (handedOff) return { done: false, reason: 'handed off' }
        if (message.subtype !== 'success') return { done: false, reason: String(message.subtype) }
        return { done: true, text: String(message.result ?? '').trim(), steps, ms: Date.now() - started }
      }
    }
    return { done: false, reason: handedOff ? 'handed off' : 'no result' }
  } catch (error) {
    if (handedOff) return { done: false, reason: 'handed off' }
    // Without Accessibility the hands have nothing to press; the chat can
    // still look at the screen and say so.
    if (error instanceof NoAccessibility) return { done: false, reason: 'no accessibility' }
    console.error('[hands]', (error as Error).message)
    return { done: false, reason: (error as Error).message }
  }
}
