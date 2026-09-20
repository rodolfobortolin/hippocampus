// A casca do Hipocampo: uma janela, um ícone na barra e o núcleo vivo por trás.
const {
  app, BrowserWindow, Tray, Menu, shell, nativeImage, session, globalShortcut, screen,
  ipcMain, dialog,
} = require('electron')
const { spawn } = require('node:child_process')
const path = require('node:path')
const fs = require('node:fs')
const http = require('node:http')
const WebSocket = require('ws')
const { execFile } = require('node:child_process')

const RAIZ = path.join(__dirname, '..')
const DEV = process.env.HIPOCAMPO_DEV === '1'
const PORTA = Number(process.env.HIPOCAMPO_PORT || 7878)
const ENDERECO = DEV ? 'http://localhost:5179' : `http://127.0.0.1:${PORTA}`

const PRELOAD = path.join(__dirname, 'preload.cjs')
// O registrador dos agentes só existe no app empacotado; rodando do código, os
// agentes continuam vindo do `npm run install:agent`.
const REGISTRADOR = path.join(process.resourcesPath ?? '', '..', 'MacOS', 'hipocampo-agentes')

/**
 * Chama o registrador e devolve o que ele imprimiu.
 *
 * Ele fala JSON no `estado` e texto nos outros comandos. Falha vira `null` em
 * vez de exceção: o app tem que abrir mesmo com os agentes desarrumados, senão
 * a única tela que permite arrumá-los fica inalcançável.
 */
function agents(comando) {
  return new Promise((resolve) => {
    if (!fs.existsSync(REGISTRADOR)) return resolve(null)
    execFile(REGISTRADOR, [comando], { timeout: 15_000 }, (erro, saida) => {
      if (erro && !saida) return resolve(null)
      try {
        resolve(comando === 'estado' ? JSON.parse(saida) : { saida: String(saida).trim() })
      } catch {
        resolve({ saida: String(saida).trim() })
      }
    })
  })
}
// Onde o núcleo flutuante ficou da última vez. Fica fora do banco de propósito:
// o Electron sobe antes do núcleo, e a janela não pode esperar por ele.
const MEMORIA_JANELA = path.join(app.getPath('userData'), 'nucleo.json')

let janela = null
let janelaNucleo = null
let bandeja = null
let nucleo = null
let escuta = null

function lembraPosicao() {
  try {
    return JSON.parse(fs.readFileSync(MEMORIA_JANELA, 'utf8'))
  } catch {
    return null
  }
}

function guardaPosicao() {
  if (!janelaNucleo) return
  const [x, y] = janelaNucleo.getPosition()
  try {
    fs.writeFileSync(MEMORIA_JANELA, JSON.stringify({ x, y }))
  } catch {
    // Perder a posição é chato, não é fatal.
  }
}

function nucleoResponde() {
  return new Promise((resolve) => {
    const pedido = http.get(`http://127.0.0.1:${PORTA}/api/status`, { timeout: 1200 }, (resposta) => {
      resposta.resume()
      resolve(resposta.statusCode === 200)
    })
    pedido.on('error', () => resolve(false))
    pedido.on('timeout', () => { pedido.destroy(); resolve(false) })
  })
}

/** Sobe o núcleo só se ninguém já estiver medindo — o agente do launchd tem precedência. */
async function garanteNucleo() {
  if (await nucleoResponde()) return
  // O Node roda TypeScript nativo: um processo só, sem o invólucro do tsx
  // (que sobrevivia ao encerramento e deixava coletor órfão para trás).
  nucleo = spawn(process.execPath, [
    '--experimental-strip-types',
    '--disable-warning=ExperimentalWarning',
    path.join(RAIZ, 'core', 'index.ts'),
  ], {
    cwd: RAIZ,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    stdio: 'ignore',
  })
  nucleo.unref()
  for (let tentativa = 0; tentativa < 25; tentativa++) {
    await new Promise((r) => setTimeout(r, 400))
    if (await nucleoResponde()) return
  }
}

function abreJanela() {
  if (janela) {
    janela.show()
    janela.focus()
    return
  }
  janela = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    show: false,
    title: 'Hipocampo',
    backgroundColor: '#07080a',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 18 },
    vibrancy: 'under-window',
    visualEffectState: 'active',
    webPreferences: { contextIsolation: true, nodeIntegration: false, preload: PRELOAD },
  })

  janela.loadURL(ENDERECO)
  janela.once('ready-to-show', () => janela.show())
  janela.on('closed', () => { janela = null })

  // Link externo abre no navegador, não dentro do app.
  janela.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

/**
 * O núcleo solto: uma janela sem moldura, sempre por cima, só com a esfera.
 *
 * É o app quando você não quer o app — fica num canto por cima do que você
 * estiver fazendo, escuta com um clique e responde falando. Fechar o painel
 * não encerra nada; esta janela e o coletor seguem por conta própria.
 */
function abreNucleo(roubaFoco = true) {
  if (janelaNucleo) {
    if (roubaFoco) {
      janelaNucleo.show()
      janelaNucleo.focus()
    } else {
      janelaNucleo.showInactive()
    }
    return
  }

  const area = screen.getPrimaryDisplay().workArea
  const largura = 260
  const altura = 330
  // Volta onde estava. Se o monitor em que ele morava não existe mais, o
  // Electron encaixaria a janela fora da vista — daí a conferência.
  const lembrada = lembraPosicao()
  const visivel = lembrada && screen.getAllDisplays().some(({ workArea: a }) =>
    lembrada.x + largura > a.x && lembrada.x < a.x + a.width &&
    lembrada.y + altura > a.y && lembrada.y < a.y + a.height)

  janelaNucleo = new BrowserWindow({
    width: largura,
    height: altura,
    x: visivel ? lembrada.x : area.x + area.width - largura - 24,
    y: visivel ? lembrada.y : area.y + area.height - altura - 24,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, preload: PRELOAD },
  })

  // Acima de tela cheia também: ele não some quando você entra num app inteiro.
  janelaNucleo.setAlwaysOnTop(true, 'floating')
  janelaNucleo.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  janelaNucleo.loadURL(`${ENDERECO}#nucleo`)
  janelaNucleo.once('ready-to-show', () =>
    roubaFoco ? janelaNucleo.show() : janelaNucleo.showInactive())
  janelaNucleo.on('moved', guardaPosicao)
  janelaNucleo.on('closed', () => { janelaNucleo = null })
}

/**
 * Traz o núcleo para a frente e manda escutar.
 *
 * É isto que a palavra de ativação e o atalho fazem: a esfera aparece onde
 * você a deixou, já ouvindo, sem tirar o foco do que você estava fazendo —
 * por isso `showInactive`, e não `show`.
 */
function chamaNucleo() {
  const novo = !janelaNucleo
  abreNucleo(false)
  const acorda = () => janelaNucleo?.webContents.send('core:wake')
  if (novo) janelaNucleo.webContents.once('did-finish-load', acorda)
  else acorda()
}

/** Ouve o núcleo para saber quando a palavra de ativação foi dita. */
function escutaONucleo() {
  if (escuta) return
  escuta = new WebSocket(`ws://127.0.0.1:${PORTA}/ws`, { origin: `http://127.0.0.1:${PORTA}` })
  escuta.on('message', (cru) => {
    try {
      if (JSON.parse(String(raw)).type === 'acordar') chamaNucleo()
    } catch {
      // Mensagem que não é JSON não é nossa.
    }
  })
  const reconecta = () => {
    escuta = null
    setTimeout(escutaONucleo, 4000)
  }
  escuta.on('close', reconecta)
  escuta.on('error', reconecta)
}

/**
 * Esconde em vez de fechar.
 *
 * Fechar destrói a cena de WebGL, e a palavra de ativação passaria a esperar um
 * a dois segundos de carregamento antes de poder ouvir. Escondida, a janela
 * volta na hora — e o Chromium suspende o `requestAnimationFrame` de janela
 * oculta, então a esfera parada não custa nada.
 */
function alternaNucleo() {
  if (janelaNucleo?.isVisible()) janelaNucleo.hide()
  else abreNucleo()
}

function montaBandeja() {
  const icone = nativeImage.createFromPath(path.join(RAIZ, 'public', 'trayTemplate.png'))
  icone.setTemplateImage(true)
  bandeja = new Tray(icone)
  bandeja.setToolTip('Hipocampo — medindo')
  bandeja.setContextMenu(Menu.buildFromTemplate([
    { label: 'Abrir o Hipocampo', click: abreJanela },
    { label: 'Núcleo flutuante', accelerator: 'Cmd+Shift+H', click: alternaNucleo },
    { label: 'Falar com o Hipocampo', accelerator: 'Cmd+Shift+Space', click: chamaNucleo },
    { type: 'separator' },
    {
      label: 'Fechar o dia de ontem',
      click: () => {
        const ontem = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
        http.request(`http://127.0.0.1:${PORTA}/api/rollup?dia=${ontem}`, { method: 'POST' }).end()
      },
    },
    { label: 'Abrir a pasta dos dados', click: () => shell.openPath(
      path.join(app.getPath('appData'), 'Hipocampo')) },
    { type: 'separator' },
    { label: 'Sair', click: () => app.quit() },
  ]))
  bandeja.on('click', abreJanela)
}

app.whenReady().then(async () => {
  // Sem isto o Electron nega getUserMedia em silêncio e o microfone parece
  // simplesmente não funcionar. Só a própria interface, em 127.0.0.1, é
  // atendida; qualquer outra origem continua negada.
  session.defaultSession.setPermissionRequestHandler((conteudo, permissao, permitir) => {
    const origem = new URL(conteudo.getURL()).hostname
    const local = origem === '127.0.0.1' || origem === 'localhost'
    permitir(local && (permissao === 'media' || permissao === 'audioCapture'))
  })

  // O ícone do Dock vem do .icns, que traz todas as resoluções; o da barra de
  // menus é máscara monocromática, recolorida pelo próprio sistema.
  if (process.platform === 'darwin') {
    app.dock?.setIcon(nativeImage.createFromPath(path.join(RAIZ, 'build', 'icon.icns')))
  }
  // O seletor de pastas do vault. Fica no processo principal porque só ele
  // tem acesso ao sistema de arquivos e aos diálogos do macOS.
  ipcMain.handle('choose-folder', async () => {
    const escolha = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      message: 'Escolha a pasta do seu vault do Obsidian',
    })
    return escolha.canceled ? null : escolha.filePaths[0] ?? null
  })

  // Arrastar a esfera move a janela. Não dá para usar `-webkit-app-region:
  // drag` aqui: ela engole o clique, e o clique é como se fala com o núcleo.
  ipcMain.on('core:move', (_evento, { dx, dy }) => {
    if (!janelaNucleo) return
    const [x, y] = janelaNucleo.getPosition()
    janelaNucleo.setPosition(Math.round(x + dx), Math.round(y + dy))
  })
  ipcMain.on('core:settle', guardaPosicao)

  // Medir o dia é a função do app, mas ligar um agente que sobe no login é
  // decisão de quem usa — e o macOS pede aprovação dela. Por isso vive na tela
  // de Ajustes, e não num registro silencioso na primeira abertura.
  ipcMain.handle('agents:status', () => agents('estado'))
  ipcMain.handle('agents:register', () => agents('registrar'))
  ipcMain.handle('agents:unregister', () => agents('desregistrar'))

  await garanteNucleo()
  montaBandeja()
  abreJanela()
  escutaONucleo()
  // Chamar o núcleo de qualquer lugar, sem procurar o app. Um atalho já tomado
  // por outro app falha calado, e o sintoma seria "o atalho não funciona" sem
  // pista nenhuma — daí o aviso.
  for (const [combinacao, acao] of [
    ['CommandOrControl+Shift+H', alternaNucleo],
    ['CommandOrControl+Shift+Space', chamaNucleo],
  ]) {
    if (!globalShortcut.register(combinacao, acao)) {
      console.warn(`[atalho] ${combinacao} já está tomado por outro app`)
    }
  }
})

app.on('activate', abreJanela)
// O app vive na barra de menus: fechar a janela não encerra a medição.
app.on('window-all-closed', () => {})
app.on('before-quit', () => {
  globalShortcut.unregisterAll()
  escuta?.close()
  if (nucleo) nucleo.kill()
})
