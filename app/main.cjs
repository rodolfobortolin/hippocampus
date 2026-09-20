// A casca do Hipocampo: uma janela, um ícone na barra e o núcleo vivo por trás.
const { app, BrowserWindow, Tray, Menu, shell, nativeImage } = require('electron')
const { spawn } = require('node:child_process')
const path = require('node:path')
const http = require('node:http')

const RAIZ = path.join(__dirname, '..')
const DEV = process.env.HIPOCAMPO_DEV === '1'
const PORTA = Number(process.env.HIPOCAMPO_PORT || 7878)
const ENDERECO = DEV ? 'http://localhost:5179' : `http://127.0.0.1:${PORTA}`

let janela = null
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
  const tsx = path.join(RAIZ, 'node_modules', 'tsx', 'dist', 'cli.mjs')
  nucleo = spawn(process.execPath, [tsx, path.join(RAIZ, 'core', 'index.ts')], {
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

function montaBandeja() {
  const icone = nativeImage.createFromPath(path.join(RAIZ, 'public', 'trayTemplate.png'))
  icone.setTemplateImage(true)
  bandeja = new Tray(icone)
  bandeja.setToolTip('Hipocampo — medindo')
  bandeja.setContextMenu(Menu.buildFromTemplate([
    { label: 'Abrir o Hipocampo', click: abreJanela },
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
  if (process.platform === 'darwin') app.dock?.setIcon(
    nativeImage.createFromPath(path.join(RAIZ, 'public', 'trayTemplate@2x.png')))
  await garanteNucleo()
  montaBandeja()
  abreJanela()
})

app.on('activate', abreJanela)
// O app vive na barra de menus: fechar a janela não encerra a medição.
app.on('window-all-closed', () => {})
app.on('before-quit', () => { if (nucleo) nucleo.kill() })
