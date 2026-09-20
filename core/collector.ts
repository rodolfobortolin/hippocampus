import { config } from './config.ts'
import { setMeta, getMeta } from './db.ts'
import { dayOf } from './config.ts'
import { FocusCollector } from './sources/focus.ts'
import { harvestSkysight, skysightAvailable } from './sources/skysight.ts'
import { harvestBrowsers } from './sources/browser.ts'
import { harvestClaudeSessions } from './sources/ai.ts'
import { harvestGit } from './sources/git.ts'
import { harvestShell } from './sources/shell.ts'
import { rollup } from './rollup.ts'
import { all } from './db.ts'
import { backfillAll } from './backfill.ts'
import { comLimite, estadoDasFontes } from './limite.ts'

type Task = { name: string; everyMinutes: number; run: () => unknown | Promise<unknown> }

const tasks: Task[] = [
  { name: 'skysight', everyMinutes: 2, run: harvestSkysight },
  { name: 'navegadores', everyMinutes: 10, run: harvestBrowsers },
  { name: 'claude', everyMinutes: 10, run: harvestClaudeSessions },
  { name: 'shell', everyMinutes: 15, run: harvestShell },
  { name: 'git', everyMinutes: 30, run: () => harvestGit(2) },
]

/**
 * O coletor: amostra o foco continuamente e passa nas outras fontes de tempos
 * em tempos. Fecha o dia anterior quando a data vira.
 */
export class Collector {
  readonly focus = new FocusCollector({
    onTrust: (trusted) => {
      setMeta('ax.trusted', trusted ? '1' : '0')
      console.log(`[permissão] acessibilidade ${trusted ? 'concedida — títulos de janela ligados' : 'ausente — só o nome do app'}`)
    },
  })
  private timers: NodeJS.Timeout[] = []
  private lastRun = new Map<string, number>()
  private currentDay = dayOf(new Date())
  running = false

  start(): void {
    this.running = true
    this.focus.start()
    setMeta('collector.started', String(Math.floor(Date.now() / 1000)))
    console.log(`[coletor] de pé — amostra a cada ${config.sampleInterval}s`)
    if (!skysightAvailable()) console.log('[coletor] Skysight ausente; seguindo sem os eventos finos')

    for (const task of tasks) {
      const tick = async () => {
        // 90s é muito mais do que qualquer coleta honesta precisa; o que passa
        // disso está preso num diálogo de permissão, não trabalhando.
        const result = await comLimite(task.name, 90_000, async () => task.run())
        if (result === null) return
        this.lastRun.set(task.name, Math.floor(Date.now() / 1000))
        const summary = JSON.stringify(result)
        if (summary && summary !== '{}' && /[1-9]/.test(summary)) {
          console.log(`[${task.name}]`, summary)
        }
      }
      void tick()
      this.timers.push(setInterval(tick, task.everyMinutes * 60_000))
    }

    // A cada minuto confere se o dia virou; se virou, fecha o anterior.
    this.timers.push(setInterval(() => void this.checkDayRollover(), 60_000))

    // Nada fica para trás: dias medidos sem fechamento entram na fila agora.
    setTimeout(() => void this.catchUp(), 15_000)
  }

  /**
   * Fecha os dias que ficaram sem narrativa — a máquina pode ter dormido na
   * virada, ou o coletor ter ficado fora do ar. Um por vez, para não disparar
   * várias sessões do Claude Code de uma vez.
   */
  private async catchUp(): Promise<void> {
    try {
      const reconstruidos = backfillAll()
      for (const dia of reconstruidos) {
        console.log(`[coletor] ${dia.day} reconstruído dos eventos: ${dia.blocks} blocos`)
      }

      const pendentes = all<any>(
        `select b.day, sum(b.seconds) total from blocks b
          where b.idle = 0 and b.day < ?
            and not exists (select 1 from days d where d.day = b.day and d.narrative <> '')
          group by b.day having total > 600 order by b.day desc limit 5`, this.currentDay)

      for (const pendente of pendentes) {
        console.log(`[coletor] fechando dia atrasado ${pendente.day}`)
        await rollup(pendente.day)
      }
    } catch (error) {
      console.error('[coletor] fila de atraso falhou:', (error as Error).message)
    }
  }

  private async checkDayRollover(): Promise<void> {
    const now = dayOf(new Date())
    if (now === this.currentDay) return
    const closing = this.currentDay
    this.currentDay = now
    console.log(`[coletor] o dia virou; fechando ${closing}`)
    try {
      const result = await rollup(closing)
      setMeta('rollup.last', closing)
      console.log(`[coletor] ${closing} fechado (${result.classified} janelas classificadas)`)
    } catch (error) {
      console.error('[coletor] fechamento falhou:', (error as Error).message)
    }
  }

  status() {
    return {
      running: this.running,
      trusted: this.focus.trusted,
      lastSample: this.focus.lastSample,
      skysight: skysightAvailable(),
      lastRun: Object.fromEntries(this.lastRun),
      fontes: estadoDasFontes(),
      startedAt: Number(getMeta('collector.started', '0')),
      lastRollup: getMeta('rollup.last', ''),
    }
  }

  stop(): void {
    this.running = false
    for (const timer of this.timers) clearInterval(timer)
    this.timers = []
    this.focus.stop()
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const collector = new Collector()
  collector.start()
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => { collector.stop(); process.exit(0) })
  }
}
