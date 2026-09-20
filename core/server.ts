import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { WebSocketServer } from 'ws'
import { config, today, dayOf } from './config.ts'
import { all, one } from './db.ts'
import { dayReport, rangeReport, heatmap, overview, knownProjects, periodSummary } from './metrics.ts'
import { chat } from './agent.ts'
import { rollup } from './rollup.ts'
import { jevReady } from './jev.ts'
import { claudeAvailable } from './claude.ts'
import { vaultReady } from './vault.ts'
import type { Collector } from './collector.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const distDir = path.join(root, 'dist')

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json',
  '.woff2': 'font/woff2', '.png': 'image/png',
}

function json(response: http.ServerResponse, data: unknown, status = 200): void {
  const body = JSON.stringify(data)
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(body) })
  response.end(body)
}

/**
 * Sobe a API local. Escuta só em 127.0.0.1 — nada disso fica exposto na rede.
 * O coletor pode ser ligado depois, com `serve.attach`, para que o servidor
 * nunca espere por uma coleta para começar a responder.
 */
let anexado: Collector | undefined
let despertar: ((evento: unknown) => void) | undefined

export function serve(collector?: Collector): http.Server {
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`)
    const route = url.pathname
    const query = url.searchParams

    // A interface roda noutra porta durante o desenvolvimento; libera só a máquina local.
    const origin = request.headers.origin
    if (origin && /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin)) {
      response.setHeader('access-control-allow-origin', origin)
      response.setHeader('access-control-allow-headers', 'content-type')
    }
    if (request.method === 'OPTIONS') {
      response.writeHead(204)
      return response.end()
    }

    try {
      if (route === '/api/status') {
        return json(response, {
          coletor: (collector ?? anexado)?.status() ?? { running: false },
          jev: jevReady(),
          claude: await claudeAvailable(),
          vault: vaultReady(),
          voz: Boolean(config.openaiKey),
          usuario: config.userName,
          ...overview(),
        })
      }

      if (route.startsWith('/api/dia/')) {
        const day = route.slice('/api/dia/'.length)
        return json(response, dayReport(day === 'hoje' ? today() : day))
      }

      if (route === '/api/periodo') {
        const to = query.get('ate') ?? today()
        const from = query.get('de') ?? dayOf(Date.now() / 1000 - 29 * 86_400)
        return json(response, {
          de: from, ate: to,
          dias: rangeReport(from, to), ritmo: heatmap(from, to), resumo: periodSummary(from, to),
        })
      }

      if (route === '/api/dias') {
        return json(response, all(
          `select d.day, d.active_seconds, d.focus_ratio, d.top_app, d.narrative, d.recap, d.built_at
             from days d order by d.day desc limit 120`))
      }

      if (route === '/api/projetos') return json(response, knownProjects())

      if (route === '/api/rollup' && request.method === 'POST') {
        const day = query.get('dia') ?? dayOf(Date.now() / 1000 - 86_400)
        const result = await rollup(day, { narrate: query.get('narrar') !== '0' })
        return json(response, result)
      }

      if (route === '/api/acordar' && request.method === 'POST') {
        // O ouvido escutou a palavra de ativação. Quem estiver na tela decide
        // o que fazer: começar a ouvir, ou calar se estiver falando.
        for await (const _ of request) { /* descarta o corpo */ }
        despertar?.({ tipo: 'acordar' })
        response.writeHead(204)
        return response.end()
      }

      if (route === '/api/amostra' && request.method === 'POST') {
        // O helper do launchd empurra uma amostra por vez. Responde 204 seco:
        // não há nada a devolver e o helper não espera corpo.
        const pedacos: Buffer[] = []
        for await (const pedaco of request) pedacos.push(pedaco as Buffer)
        try {
          ;(collector ?? anexado)?.focus.push(JSON.parse(Buffer.concat(pedacos).toString()))
        } catch {
          response.writeHead(400)
          return response.end()
        }
        response.writeHead(204)
        return response.end()
      }

      if (route === '/api/transcrever' && request.method === 'POST') {
        // A API de voz do navegador não funciona no Electron: ela depende de um
        // serviço do Google que só o Chrome tem credencial para usar, e falha
        // na hora com erro de rede. Aqui o áudio é gravado e transcrito.
        if (!config.openaiKey) return json(response, { erro: 'sem chave' }, 400)
        const pedacos: Buffer[] = []
        for await (const pedaco of request) pedacos.push(pedaco as Buffer)
        const audio = Buffer.concat(pedacos)
        if (!audio.length) return json(response, { erro: 'áudio vazio' }, 400)

        const formulario = new FormData()
        formulario.append('file', new Blob([audio], { type: 'audio/webm' }), 'fala.webm')
        formulario.append('model', 'gpt-4o-mini-transcribe')
        // Sem a dica de idioma o modelo confunde português com italiano.
        formulario.append('language', config.lang.split('-')[0])

        const resposta = await fetch(`${config.openaiBaseUrl}/audio/transcriptions`, {
          method: 'POST',
          headers: { authorization: `Bearer ${config.openaiKey}` },
          body: formulario,
        })
        if (!resposta.ok) {
          return json(response, { erro: (await resposta.text()).slice(0, 300) }, 502)
        }
        const dados = (await resposta.json()) as { text?: string }
        return json(response, { texto: (dados.text ?? '').trim() })
      }

      if (route === '/api/voz' && request.method === 'POST') {
        // Fala o texto com a voz da OpenAI. Sem chave, o app usa a voz do sistema.
        if (!config.openaiKey) return json(response, { erro: 'sem chave' }, 400)
        const chunks: Buffer[] = []
        for await (const chunk of request) chunks.push(chunk as Buffer)
        const { texto, voz } = JSON.parse(Buffer.concat(chunks).toString() || '{}')
        const speech = await fetch(`${config.openaiBaseUrl}/audio/speech`, {
          method: 'POST',
          headers: { authorization: `Bearer ${config.openaiKey}`, 'content-type': 'application/json' },
          body: JSON.stringify({ model: 'gpt-4o-mini-tts', voice: voz ?? 'onyx', input: String(texto).slice(0, 4000) }),
        })
        if (!speech.ok) return json(response, { erro: await speech.text() }, 502)
        const audio = Buffer.from(await speech.arrayBuffer())
        response.writeHead(200, { 'content-type': 'audio/mpeg', 'content-length': audio.length })
        return response.end(audio)
      }

      // Em produção o próprio núcleo serve a interface compilada.
      if (!route.startsWith('/api/') && fs.existsSync(distDir)) {
        const candidate = path.join(distDir, route === '/' ? 'index.html' : route.slice(1))
        const file = fs.existsSync(candidate) && fs.statSync(candidate).isFile()
          ? candidate : path.join(distDir, 'index.html')
        if (fs.existsSync(file)) {
          const body = fs.readFileSync(file)
          response.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' })
          return response.end(body)
        }
      }

      json(response, { erro: 'não encontrado' }, 404)
    } catch (error) {
      console.error('[api]', route, (error as Error).message)
      json(response, { erro: (error as Error).message }, 500)
    }
  })

  const sockets = new WebSocketServer({ server, path: '/ws' })

  /** Avisa todas as telas abertas — painel e núcleo flutuante. */
  const avisarTodos = (evento: unknown) => {
    const texto = JSON.stringify(evento)
    for (const cliente of sockets.clients) {
      if (cliente.readyState === cliente.OPEN) cliente.send(texto)
    }
  }
  despertar = avisarTodos
  sockets.on('connection', (socket, request) => {
    // Só a própria interface conversa com o núcleo.
    const origin = request.headers.origin
    if (origin && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin)) {
      socket.close(1008, 'origem não autorizada')
      return
    }

    let session: string | undefined
    socket.on('message', async (raw) => {
      let payload: any
      try { payload = JSON.parse(String(raw)) } catch { return }
      if (payload.tipo !== 'pergunta' || !payload.texto) return

      const send = (event: unknown) => socket.readyState === socket.OPEN && socket.send(JSON.stringify(event))
      send({ tipo: 'pensando' })
      try {
        for await (const event of chat(String(payload.texto), session)) {
          if (event.type === 'modelo') send({ tipo: 'modelo', modelo: event.modelo, nivel: event.nivel })
          else if (event.type === 'fim') send({ tipo: 'fim', texto: event.texto })
          else if (event.type === 'texto') send({ tipo: 'texto', texto: event.texto })
          else if (event.type === 'ferramenta') send({ tipo: 'ferramenta', nome: event.nome })
          else send({ tipo: 'erro', erro: event.erro })
        }
      } catch (error) {
        send({ tipo: 'erro', erro: (error as Error).message })
      }
    })
  })

  server.on('error', (error) => {
    console.error('[núcleo] não consegui escutar:', (error as Error).message)
  })
  server.listen(config.port, '127.0.0.1', () => {
    console.log(`[núcleo] http://127.0.0.1:${config.port}`)
  })
  return server
}

/** Liga o coletor ao servidor já no ar, para o /api/status enxergar o estado. */
export function attachCollector(collector: Collector): void {
  anexado = collector
}
