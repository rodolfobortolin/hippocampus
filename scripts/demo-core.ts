// Serves the API over the demo database, and nothing else.
//
// The real entry point starts the collector too, which would sample whatever
// is on this screen right now into the demo data — the one thing the demo
// exists to keep out. So this starts the server alone.
//
//   HIPPOCAMPUS_DATA=/tmp/hippocampus-demo HIPPOCAMPUS_PORT=7979 \
//     node --experimental-strip-types scripts/demo-core.ts

import os from 'node:os'
import path from 'node:path'

const target = (process.env.HIPPOCAMPUS_DATA ?? '').trim()
const real = path.join(os.homedir(), 'Library', 'Application Support', 'Hippocampus')
if (!target || path.resolve(target) === path.resolve(real)) {
  console.error('Point HIPPOCAMPUS_DATA at the demo folder, not the real one.')
  process.exit(1)
}

const { applySettings } = await import('../core/settings.ts')
const { serve, attachCollector } = await import('../core/server.ts')
applySettings()
serve()

// What the sidebar reads. Without a collector it says "stopped", which is true
// here and misleading in a screenshot of an app that is normally running — so
// the demo answers as a running one would, with a window of the demo's own.
attachCollector({
  status: () => ({
    running: true, trusted: true, pushed: true, skysight: false, lastRun: {}, sources: {},
    lastSample: { app: 'Code', title: 'orders.ts — harbor', idle: 0, locked: false },
    startedAt: Math.floor(Date.now() / 1000) - 3 * 3600, lastRollup: '',
  }),
  focus: { push: () => {} },
} as any)
