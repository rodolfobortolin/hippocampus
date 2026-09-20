import { spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import { config, paths, dayOf } from '../config.ts'
import { db } from '../db.ts'
import { ehSigiloso } from '../privacidade.ts'

type Sample = {
  ts: string
  idle: number
  locked: boolean
  trusted: boolean
  /** Contadores acumulados desde o boot; o que vale é o delta entre amostras. */
  keys?: number
  clicks?: number
  scroll?: number
  mic?: boolean
  /** Alguma saída de áudio tocando. */
  som?: boolean
  /** A escuta da palavra de ativação está ligada (e portanto segura o microfone). */
  escuta?: boolean
  /** App de mídia aberto — pista fraca: aberto não é tocando. */
  midiaAberta?: string
  /** O que está tocando, quando dá para perguntar ao player ou achar a aba. */
  tocando?: string
  /** Nome da tela onde a janela em foco está. */
  tela?: string
  app?: string
  bundle?: string
  title?: string
  url?: string
}

type Open = { id: number; key: string; startedAt: number; endedAt: number }
type Contadores = { keys: number; clicks: number; scroll: number }

const insert = db.prepare(
  `insert into blocks (started_at, ended_at, seconds, day, app, bundle, title, url, host, idle,
                       keys, clicks, scroll, mic)
   values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
)
const extend = db.prepare(
  `update blocks set ended_at = ?, seconds = ?,
          keys = keys + ?, clicks = clicks + ?, scroll = scroll + ?,
          mic = max(mic, ?), som = max(som, ?)
     where id = ?`,
)

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
  /** Verdadeiro quando as amostras chegam de fora, empurradas pelo helper. */
  empurrado = false
  private open: Open | null = null
  private buffer = ''
  private anterior: Contadores | null = null
  private onTrust?: (trusted: boolean) => void
  lastSample: Sample | null = null
  trusted = false

  constructor(options: { onTrust?: (trusted: boolean) => void } = {}) {
    this.onTrust = options.onTrust
  }

  /**
   * Recebe uma amostra vinda do helper lançado pelo launchd.
   *
   * É o caminho preferido: assim o helper responde por si mesmo no TCC, e a
   * permissão de Acessibilidade fica com ele em vez de com o node.
   */
  push(sample: unknown): void {
    this.empurrado = true
    try {
      this.ingest(sample as Sample)
    } catch (error) {
      console.error('[foco] amostra inválida:', (error as Error).message)
    }
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

    // Os contadores são acumulados desde o boot: o que interessa é o quanto
    // andou desde a amostra anterior. Reinício da máquina zera e o delta sai
    // negativo — nesse caso a amostra não conta em vez de virar número absurdo.
    const agora: Contadores = {
      keys: sample.keys ?? 0, clicks: sample.clicks ?? 0, scroll: sample.scroll ?? 0,
    }
    const bruto = this.anterior
      ? {
          keys: agora.keys - this.anterior.keys,
          clicks: agora.clicks - this.anterior.clicks,
          scroll: agora.scroll - this.anterior.scroll,
        }
      : { keys: 0, clicks: 0, scroll: 0 }
    const delta = Object.values(bruto).some((v) => v < 0) ? { keys: 0, clicks: 0, scroll: 0 } : bruto
    this.anterior = agora
    // A escuta própria não conta como chamada.
    const mic = sample.mic && !sample.escuta ? 1 : 0
    const idle = sample.locked || sample.idle >= config.idleThreshold
    const app = idle ? (sample.locked ? 'Tela bloqueada' : 'Ocioso') : sample.app ?? 'Desconhecido'
    // O tempo num gerenciador de senha ou no banco continua contando; o que
    // estava escrito na barra de título, não.
    const sigiloso = !idle && ehSigiloso(sample.app, sample.title, sample.url)
    const title = idle || sigiloso ? null : sample.title ?? null
    const key = `${idle ? 'idle' : 'live'}|${app}|${title ?? ''}|${sample.tela ?? ''}|${sample.tocando ?? ''}`

    // Buraco grande (sono, coletor parado) fecha o bloco aberto.
    const gap = this.open ? ts - this.open.endedAt : 0
    if (this.open && (this.open.key !== key || gap > config.sampleInterval * 4)) this.open = null

    if (this.open) {
      this.open.endedAt = ts
      extend.run(ts, ts - this.open.startedAt, delta.keys, delta.clicks, delta.scroll,
        mic, sample.som ? 1 : 0, this.open.id)
      return
    }

    const url = idle || sigiloso ? null : sample.url ?? null
    const result = insert.run(
      ts, ts, 0, dayOf(ts), app, idle ? null : sample.bundle ?? null,
      title, url, hostOf(url ?? undefined), idle ? 1 : 0,
      delta.keys, delta.clicks, delta.scroll, mic, idle ? null : sample.tela ?? null,
      sample.som ? 1 : 0,
      // Com a escuta ligada o microfone está sempre aberto por nossa causa;
      // marcar chamada nesse estado seria inventar reunião todo dia.
      sample.escuta ? null : sample.midiaAberta ?? null, sample.tocando ?? null,
    )
    this.open = { id: Number(result.lastInsertRowid), key, startedAt: ts, endedAt: ts }
  }
}
