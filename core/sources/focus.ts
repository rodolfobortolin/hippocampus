import { spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import { config, paths, dayOf } from '../config.ts'
import { db } from '../db.ts'

type Sample = {
  ts: string
  idle: number
  locked: boolean
  trusted: boolean
  app?: string
  bundle?: string
  title?: string
  url?: string
}

type Open = { id: number; key: string; startedAt: number; endedAt: number }

const insert = db.prepare(
  `insert into blocks (started_at, ended_at, seconds, day, app, bundle, title, url, host, idle)
   values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
)
const extend = db.prepare('update blocks set ended_at = ?, seconds = ? where id = ?')

function hostOf(url?: string): string | null {
  if (!url) return null
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

/**
 * Lê o helper nativo e transforma amostras em blocos contínuos.
 * O bloco é gravado assim que começa e estendido a cada amostra, então
 * uma queda do coletor perde no máximo uma amostra.
 */
export class FocusCollector {
  private child: ChildProcess | null = null
  private open: Open | null = null
  private buffer = ''
  private onTrust?: (trusted: boolean) => void
  lastSample: Sample | null = null
  trusted = false

  constructor(options: { onTrust?: (trusted: boolean) => void } = {}) {
    this.onTrust = options.onTrust
  }

  start(): void {
    if (!fs.existsSync(paths.native)) {
      console.error('[foco] helper nativo ausente — rode `npm run build:native`')
      return
    }
    this.child = spawn(paths.native, ['--interval', String(config.sampleInterval)], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    this.child.stdout?.on('data', (chunk) => this.consume(String(chunk)))
    this.child.stderr?.on('data', (chunk) => console.error('[foco]', String(chunk).trim()))
    this.child.on('exit', (code) => {
      console.error(`[foco] helper saiu (${code}); tentando de novo em 5s`)
      this.child = null
      this.open = null
      setTimeout(() => this.start(), 5000)
    })
  }

  stop(): void {
    this.child?.kill()
    this.child = null
    this.open = null
  }

  private consume(chunk: string): void {
    this.buffer += chunk
    const lines = this.buffer.split('\n')
    this.buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.trim()) continue
      try {
        this.ingest(JSON.parse(line) as Sample)
      } catch {
        /* linha parcial ou inválida — ignora */
      }
    }
  }

  private ingest(sample: Sample): void {
    this.lastSample = sample
    if (sample.trusted !== this.trusted) {
      this.trusted = sample.trusted
      this.onTrust?.(sample.trusted)
    }

    const ts = Math.floor(new Date(sample.ts).getTime() / 1000)
    const idle = sample.locked || sample.idle >= config.idleThreshold
    const app = idle ? (sample.locked ? 'Tela bloqueada' : 'Ocioso') : sample.app ?? 'Desconhecido'
    const title = idle ? null : sample.title ?? null
    const key = `${idle ? 'idle' : 'live'}|${app}|${title ?? ''}`

    // Buraco grande (sono, coletor parado) fecha o bloco aberto.
    const gap = this.open ? ts - this.open.endedAt : 0
    if (this.open && (this.open.key !== key || gap > config.sampleInterval * 4)) this.open = null

    if (this.open) {
      this.open.endedAt = ts
      extend.run(ts, ts - this.open.startedAt, this.open.id)
      return
    }

    const url = idle ? null : sample.url ?? null
    const result = insert.run(
      ts, ts, 0, dayOf(ts), app, idle ? null : sample.bundle ?? null,
      title, url, hostOf(url ?? undefined), idle ? 1 : 0,
    )
    this.open = { id: Number(result.lastInsertRowid), key, startedAt: ts, endedAt: ts }
  }
}
