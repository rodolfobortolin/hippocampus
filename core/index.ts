import { Collector } from './collector.ts'
import { serve, attachCollector } from './server.ts'

// O servidor sobe primeiro, de propósito: uma coleta pode ficar presa num
// diálogo de permissão do macOS, e a interface não pode depender disso.
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
