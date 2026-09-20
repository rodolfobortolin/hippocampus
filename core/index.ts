import { Collector } from './collector.ts'
import { serve, attachCollector } from './server.ts'
import { applySettings } from './settings.ts'

// What the person chose inside the app beats what came from the environment.
// Applying it before anything else is what makes the language, the name and
// the keys count from the very first sample.
applySettings()

// The server comes up first, on purpose: a harvest can get stuck on a macOS
// permission dialog, and the interface cannot depend on that.
const server = serve()
const collector = new Collector()
attachCollector(collector)
server.on('listening', () => collector.start())

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    collector.stop()
    server.close()
    process.exit(0)
  })
}
