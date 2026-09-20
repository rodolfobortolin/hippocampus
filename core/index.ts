import { Collector } from './collector.ts'
import { serve, attachCollector } from './server.ts'
import { aplicaAjustes } from './ajustes.ts'

// O que a pessoa escolheu dentro do app vence o que veio do ambiente. Aplicar
// antes de tudo é o que faz idioma, nome e chaves valerem já na primeira coleta.
aplicaAjustes()

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
