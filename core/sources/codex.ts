import fs from 'node:fs/promises'
import path from 'node:path'
import { config, dayOf } from '../config.ts'
import { db, getMeta, setMeta } from '../db.ts'
import { redact } from '../redact.ts'
import { existe } from '../limite.ts'

/**
 * As sessões do Codex, no mesmo molde das do Claude Code.
 *
 * Cada linha é um evento com carimbo de tempo. O que interessa é `response_item`
 * — raciocínio, chamada de ferramenta, resposta —, que marca o minuto em que o
 * agente estava produzindo, e a mensagem de papel `user`, que é o pedido humano.
 * Sem isso, metade do trabalho delegado desta máquina ficava invisível.
 */
const raiz = path.join(config.home, '.codex', 'sessions')

const marcaMinuto = db.prepare(
  `insert into agent_minutes (minute, agent, day, project, events) values (?, 'codex', ?, ?, 1)
   on conflict(minute, agent) do update set events = events + 1`,
)
const insereTurno = db.prepare(
  `insert or ignore into ai_turns (source_id, ts, day, project, session, prompt, tools)
   values (?, ?, ?, ?, ?, ?, ?)`,
)

export function codexAvailable(): Promise<boolean> {
  return existe(raiz)
}

// Assíncrona como o resto: recursão síncrona por uma árvore de pastas é o jeito
// mais fácil de congelar o coletor num diretório que o macOS resolva proteger.
async function arquivos(dir: string, achados: string[] = []): Promise<string[]> {
  for (const entrada of await fs.readdir(dir, { withFileTypes: true })) {
    const caminho = path.join(dir, entrada.name)
    if (entrada.isDirectory()) await arquivos(caminho, achados)
    else if (entrada.name.endsWith('.jsonl')) achados.push(caminho)
  }
  return achados
}

function textoDe(conteudo: unknown): string {
  if (typeof conteudo === 'string') return conteudo
  if (!Array.isArray(conteudo)) return ''
  return conteudo
    .filter((bloco: any) => typeof bloco?.text === 'string')
    .map((bloco: any) => bloco.text)
    .join(' ')
}

export async function harvestCodexSessions(): Promise<{ turns: number; minutes: number }> {
  if (!(await codexAvailable())) return { turns: 0, minutes: 0 }
  const offsets = JSON.parse(getMeta('codex.offsets', '{}')) as Record<string, number>
  let turns = 0
  let minutes = 0

  for (const arquivo of await arquivos(raiz)) {
    const tamanho = (await fs.stat(arquivo)).size
    const de = offsets[arquivo] ?? 0
    if (tamanho <= de) continue

    const handle = await fs.open(arquivo, 'r')
    const buffer = Buffer.alloc(tamanho - de)
    try {
      await handle.read(buffer, 0, buffer.length, de)
    } finally {
      await handle.close()
    }

    const pedaco = buffer.toString('utf8')
    const ultimaQuebra = pedaco.lastIndexOf('\n')
    if (ultimaQuebra < 0) continue
    offsets[arquivo] = de + Buffer.byteLength(pedaco.slice(0, ultimaQuebra + 1), 'utf8')

    const sessao = path.basename(arquivo).replace('.jsonl', '')
    let projeto: string | null = null

    for (const linha of pedaco.slice(0, ultimaQuebra).split('\n')) {
      if (!linha.trim()) continue
      let evento: any
      try { evento = JSON.parse(linha) } catch { continue }
      const ts = Math.floor(new Date(evento.timestamp).getTime() / 1000)
      if (!Number.isFinite(ts)) continue
      const carga = evento.payload ?? {}

      // O diretório de trabalho identifica o projeto e vem no começo da sessão.
      if (carga.cwd) projeto = path.basename(String(carga.cwd))

      if (evento.type === 'response_item') {
        marcaMinuto.run(Math.floor(ts / 60), dayOf(ts), projeto)
        minutes++

        // A mensagem de papel `user` é o pedido humano; `developer` é o sistema.
        if (carga.type === 'message' && carga.role === 'user') {
          const pedido = redact(textoDe(carga.content).replace(/\s+/g, ' ').trim())
          if (pedido) {
            insereTurno.run(`codex:${sessao}:${carga.id ?? evento.ordinal}`, ts, dayOf(ts),
              projeto, sessao, pedido.slice(0, 1200), '["codex"]')
            turns++
          }
        }
      }
    }
  }

  setMeta('codex.offsets', JSON.stringify(offsets))
  return { turns, minutes }
}
