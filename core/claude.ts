import { query } from '@anthropic-ai/claude-agent-sdk'
import { config } from './config.ts'

/**
 * Uma pergunta ao Claude Code, sem ferramentas, devolvendo o texto final.
 * Usa o login do `claude` da máquina — nada de chave de API, nada de conta nova.
 */
export async function ask(prompt: string, system: string): Promise<string> {
  const run = query({
    prompt,
    options: {
      cwd: config.dataDir,
      ...(config.claudeModel ? { model: config.claudeModel } : {}),
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
