import { query } from '@anthropic-ai/claude-agent-sdk'
import { config } from './config.ts'

/**
 * One question to Claude Code, with no tools, returning the final text.
 * Uses the machine's own `claude` login — no API key, no new account.
 */
export async function ask(prompt: string, system: string): Promise<string> {
  const run = query({
    prompt,
    options: {
      cwd: config.dataDir,
      // Explicit, not inherited from the person's Claude Code settings, which
      // put the journal and the notes on Opus at xhigh effort.
      model: config.claudeModel || 'claude-sonnet-5',
      effort: 'low',
      permissionMode: 'bypassPermissions',
      systemPrompt: { type: 'preset', preset: 'claude_code', append: system },
      allowedTools: [],
      disallowedTools: ['AskUserQuestion'],
    },
  })

  let text = ''
  for await (const message of run as any) {
    if (message.type === 'result') {
      text = message.subtype === 'success' ? message.result ?? '' : ''
    }
  }
  return text.trim()
}

export async function claudeAvailable(): Promise<boolean> {
  try {
    const { execFileSync } = await import('node:child_process')
    execFileSync('claude', ['--version'], { encoding: 'utf8', timeout: 8000 })
    return true
  } catch {
    return false
  }
}
