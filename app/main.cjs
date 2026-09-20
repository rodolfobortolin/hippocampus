// A casca do Hipocampo: uma janela, um ícone na barra e o núcleo vivo por trás.
const { app, BrowserWindow, Tray, Menu, shell, nativeImage, session, globalShortcut, screen } = require('electron')
const { spawn } = require('node:child_process')
const path = require('node:path')
const http = require('node:http')

const RAIZ = path.join(__dirname, '..')
const DEV = process.env.HIPOCAMPO_DEV === '1'
const PORTA = Number(process.env.HIPOCAMPO_PORT || 7878)
const ENDERECO = DEV ? 'http://localhost:5179' : `http://127.0.0.1:${PORTA}`

let janela = null
let janelaNucleo = null
let bandeja = null
let nucleo = null

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
    webPreferences: { contextIsolation: true, nodeIntegration: false },
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
function abreNucleo() {
  if (janelaNucleo) {
    janelaNucleo.show()
    janelaNucleo.focus()
    return
  }

  const area = screen.getPrimaryDisplay().workArea
  const largura = 260
  const altura = 330

  janelaNucleo = new BrowserWindow({
    width: largura,
    height: altura,
    x: area.x + area.width - largura - 24,
    y: area.y + area.height - altura - 24,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  })

  // Acima de tela cheia também: ele não some quando você entra num app inteiro.
  janelaNucleo.setAlwaysOnTop(true, 'floating')
  janelaNucleo.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  janelaNucleo.loadURL(`${ENDERECO}#nucleo`)
  janelaNucleo.once('ready-to-show', () => janelaNucleo.show())
  janelaNucleo.on('closed', () => { janelaNucleo = null })
}

function alternaNucleo() {
  if (janelaNucleo) {
    janelaNucleo.close()
    janelaNucleo = null
  } else {
    abreNucleo()
  }
}

function montaBandeja() {
  const icone = nativeImage.createFromPath(path.join(RAIZ, 'public', 'trayTemplate.png'))
  icone.setTemplateImage(true)
  bandeja = new Tray(icone)
  bandeja.setToolTip('Hipocampo — medindo')
  bandeja.setContextMenu(Menu.buildFromTemplate([
    { label: 'Abrir o Hipocampo', click: abreJanela },
    { label: 'Núcleo flutuante', accelerator: 'Cmd+Shift+H', click: alternaNucleo },
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
  await garanteNucleo()
  montaBandeja()
  abreJanela()
  // Chamar o núcleo de qualquer lugar, sem procurar o app.
  globalShortcut.register('CommandOrControl+Shift+H', alternaNucleo)
})

app.on('activate', abreJanela)
// O app vive na barra de menus: fechar a janela não encerra a medição.
app.on('window-all-closed', () => {})
app.on('before-quit', () => {
  globalShortcut.unregisterAll()
  if (nucleo) nucleo.kill()
})
