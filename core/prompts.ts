/**
 * What a person actually typed, out of what an agent's log calls a user turn.
 *
 * Claude Code and Codex record as "user" a good deal no one wrote: a finished
 * background task announcing itself, the output of /model, the list of
 * plugins, the environment Codex sends at the start, the page the in-app
 * browser was showing. On this machine that was one "request" in six. Counted
 * as requests, it inflated every count of questions to an agent, and tied
 * machine chatter to whatever ticket its branch named.
 *
 * Some wrappers do carry the person's words inside — the voice delegation's
 * <input>, the text after an attached image, the request after the browser's
 * context — and those words are kept.
 */

/** Blocks that are the tool talking, with everything inside them. */
const MACHINE_BLOCKS = [
  'task-notification', 'local-command-stdout', 'local-command-stderr', 'local-command-caveat',
  'command-name', 'command-message', 'command-args', 'recommended_plugins', 'environment_context',
  'system-reminder', 'send_user_message_question_reply', 'skill', 'user_instructions',
  'in-app-browser-context', 'image', 'transcript_delta',
]
const BLOCK = new RegExp(`<(${MACHINE_BLOCKS.join('|')})\\b[^>]*>[\\s\\S]*?</\\1>`, 'g')

/** Turns that are only a marker, with nothing of the person's in them. */
const MARKER = /^(\[Request interrupted[^\]]*\]|Caveat:)/

export function humanText(prompt: string | null | undefined): string | null {
  if (!prompt) return null
  let text = prompt
  // A delegation from the voice: the words said are in its input.
  const said = /<realtime_delegation>[\s\S]*?<input>([\s\S]*?)<\/input>/.exec(text)
  if (said) text = said[1]
  text = text
    .replace(BLOCK, ' ')
    .replace(/^\s*##\s*My request:\s*/i, '')
    .replace(/\[Image #\d+\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!text || MARKER.test(text)) return null
  return text
}
