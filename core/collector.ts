import { config } from './config.ts'
import { setMeta, getMeta } from './db.ts'
import { dayOf } from './config.ts'
import { FocusCollector } from './sources/focus.ts'
import { harvestSkysight, skysightAvailable, checkSkysight } from './sources/skysight.ts'
import { harvestBrowsers } from './sources/browser.ts'
import { harvestClaudeSessions } from './sources/ai.ts'
import { harvestCodexSessions } from './sources/codex.ts'
import { harvestGit } from './sources/git.ts'
import { harvestShell } from './sources/shell.ts'
import { harvestPresence } from './sources/presence.ts'
import { rollup } from './rollup.ts'
import { all } from './db.ts'
import { backfillAll } from './backfill.ts'
import { buildAllEpisodes } from './episodes.ts'
import { withTimeout, sourceStates } from './guard.ts'
import { classifyDay, labelLocally } from './jev.ts'
import { knownProjects } from './metrics.ts'

type Task = { name: string; everyMinutes: number; run: () => unknown | Promise<unknown> }

const tasks: Task[] = [
  { name: 'skysight', everyMinutes: 2, run: harvestSkysight },
  { name: 'browsers', everyMinutes: 10, run: harvestBrowsers },
  { name: 'claude', everyMinutes: 10, run: harvestClaudeSessions },
  { name: 'codex', everyMinutes: 10, run: harvestCodexSessions },
  { name: 'shell', everyMinutes: 15, run: harvestShell },
  { name: 'git', everyMinutes: 30, run: () => harvestGit(2) },
  // macOS keeps a week of it; once an hour is far more than enough to never
  // lose a stretch, and a reading costs two seconds of pmset.
  { name: 'presence', everyMinutes: 60, run: harvestPresence },
  // Today's windows, labelled as they happen. The labelling used to run only
  // when a day closed, so everything done today read "unlabelled" until
  // tomorrow — most of that slice was simply not yet looked at. A label is
  // cached per window, so this asks nothing extra: each window is asked once
  // either way, only sooner.
  { name: 'labels', everyMinutes: 10, run: () => classifyDay(dayOf(Date.now() / 1000), knownProjects()) },
]

/**
 * The collector: samples focus continuously and visits the other sources from
 * time to time. Closes the previous day when the date turns.
 */
export class Collector {
  readonly focus = new FocusCollector({
    onTrust: (trusted) => {
      setMeta('ax.trusted', trusted ? '1' : '0')
      console.log(`[permission] accessibility ${trusted ? 'granted — window titles on' : 'missing — only the app name'}`)
    },
  })
  private timers: NodeJS.Timeout[] = []
  private lastRun = new Map<string, number>()
  private currentDay = dayOf(new Date())
  running = false

  start(): void {
    this.running = true
    // Give launchd's helper a moment to show up. If nobody pushes a sample,
    // the collector launches the helper itself — that works, but then node is
    // what answers for the TCC, and the window title never arrives.
    setTimeout(() => {
      if (this.focus.pushed) {
        console.log('[focus] recebendo do helper do launchd')
        return
      }
      console.log('[focus] no helper pushing; launching one of our own')
      void this.focus.start()
    }, 12_000)
    setMeta('collector.started', String(Math.floor(Date.now() / 1000)))
    console.log(`[collector] up — one sample every ${config.sampleInterval}s`)
    void withTimeout('skysight', 20_000, checkSkysight).then((tem) => {
      if (tem === false) console.log('[coletor] Computer History ausente; seguindo sem os eventos finos')
    })

    for (const task of tasks) {
      const tick = async () => {
        // 90s is far more than any honest harvest needs; anything past that is
        // stuck on a permission dialog, not working.
        const result = await withTimeout(task.name, 90_000, async () => task.run())
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

    // A cada minute confere se o day virou; se virou, close o previous.
    this.timers.push(setInterval(() => void this.checkDayRollover(), 60_000))

    // Nothing is left behind: measured days never closed join the queue now.
    setTimeout(() => void this.catchUp(), 15_000)
  }

  /**
   * Closes the days left without a narrative — the machine may have been
   * asleep at the turn, or the collector may have been down. One at a time, so
   * this never fires several Claude Code sessions at once.
   */
  private async catchUp(): Promise<void> {
    try {
      const settled = labelLocally(null, knownProjects())
      if (settled) console.log(`[collector] ${settled} windows labelled by rule`)
      const rebuilt = backfillAll()
      for (const day of rebuilt) {
        console.log(`[collector] ${day.day} rebuilt from events: ${day.blocks} blocks`)
      }

      for (const day of buildAllEpisodes()) {
        console.log(`[collector] ${day.day}: ${day.episodes} episodes indexed`)
      }

      const pending = all<any>(
        `select b.day, sum(b.seconds) total from blocks b
          where b.idle = 0 and b.day < ?
            and not exists (select 1 from days d where d.day = b.day and d.narrative <> '')
          group by b.day having total > 600 order by b.day desc limit 5`, this.currentDay)

      for (const late of pending) {
        console.log(`[collector] closing a late day: ${late.day}`)
        await rollup(late.day)
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
    console.log(`[coletor] o day virou; fechando ${closing}`)
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
      pushed: this.focus.pushed,
      lastSample: this.focus.lastSample,
      skysight: skysightAvailable(),
      lastRun: Object.fromEntries(this.lastRun),
      sources: sourceStates(),
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
