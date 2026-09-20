import fs from 'node:fs'
import path from 'node:path'
import { config, dayOf } from '../config.ts'
import { db, getMeta, setMeta } from '../db.ts'
import { redact } from '../redact.ts'

// Cada sessão do Claude Code é um .jsonl que só cresce. Guardamos o deslocamento
// já lido de cada arquivo para não reprocessar 1 GB a cada rodada.
const root = path.join(config.home, '.claude', 'projects')

const insert = db.prepare(
  `insert or ignore into ai_turns (source_id, ts, day, project, session, prompt, tools) values (?, ?, ?, ?, ?, ?, ?)`,
)

function textOf(content: unknown): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .filter((block: any) => block?.type === 'text' && typeof block.text === 'string')
    .map((block: any) => block.text)
    .join(' ')
}

/** Lê o que há de novo nas sessões do Claude Code: seus pedidos e as ferramentas usadas. */
export function harvestClaudeSessions(): { turns: number } {
  if (!fs.existsSync(root)) return { turns: 0 }
  const offsets = JSON.parse(getMeta('claude.offsets', '{}')) as Record<string, number>
  let turns = 0

  for (const projectDir of fs.readdirSync(root)) {
    const dir = path.join(root, projectDir)
    if (!fs.statSync(dir).isDirectory()) continue
    // O nome da pasta é o caminho do projeto com as barras trocadas por hífen.
    const project = projectDir.split('-').filter(Boolean).pop() ?? projectDir

    for (const name of fs.readdirSync(dir)) {
      if (!name.endsWith('.jsonl')) continue
      const file = path.join(dir, name)
      const size = fs.statSync(file).size
      const from = offsets[file] ?? 0
      if (size <= from) continue

      const handle = fs.openSync(file, 'r')
      const buffer = Buffer.alloc(size - from)
      fs.readSync(handle, buffer, 0, buffer.length, from)
      fs.closeSync(handle)

      const chunk = buffer.toString('utf8')
      const lastBreak = chunk.lastIndexOf('\n')
      if (lastBreak < 0) continue
      offsets[file] = from + Buffer.byteLength(chunk.slice(0, lastBreak + 1), 'utf8')

      const session = name.replace('.jsonl', '')
      // Ferramentas usadas ficam agrupadas no pedido humano que as disparou.
      let lastPrompt: { id: string; tools: Set<string> } | null = null

      for (const line of chunk.slice(0, lastBreak).split('\n')) {
        if (!line.trim()) continue
        let event: any
        try { event = JSON.parse(line) } catch { continue }
        const ts = Math.floor(new Date(event.timestamp).getTime() / 1000)
        if (!Number.isFinite(ts)) continue

        if (event.type === 'user' && event.origin?.kind === 'human') {
          const prompt = redact(textOf(event.message?.content).replace(/\s+/g, ' ').trim())
          if (!prompt) continue
          const id = `${session}:${event.uuid}`
          insert.run(id, ts, dayOf(ts), event.cwd ? path.basename(event.cwd) : project, session,
            prompt.slice(0, 1200), '[]')
          lastPrompt = { id, tools: new Set() }
          turns++
        } else if (event.type === 'assistant' && lastPrompt) {
          for (const block of event.message?.content ?? []) {
            if (block?.type === 'tool_use' && block.name) lastPrompt.tools.add(String(block.name))
          }
          db.prepare('update ai_turns set tools = ? where source_id = ?')
            .run(JSON.stringify([...lastPrompt.tools]), lastPrompt.id)
        }
      }
    }
  }

  setMeta('claude.offsets', JSON.stringify(offsets))
  return { turns }
}
