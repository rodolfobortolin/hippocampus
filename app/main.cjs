// The shell: one window, a menu bar icon, and the core alive behind it.
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

const ROOT = path.join(__dirname, '..')
const DEV = process.env.HIPPOCAMPUS_DEV === '1'
const PORT = Number(process.env.HIPPOCAMPUS_PORT || 7878)
const ADDRESS = DEV ? 'http://localhost:5179' : `http://127.0.0.1:${PORT}`

const PRELOAD = path.join(__dirname, 'preload.cjs')
// Stamped once, when the process starts. The page uses it to tell a fresh
// launch from a window being shown again — it cannot tell them apart on its
// own, because this app lives in the menu bar and the window comes and goes.
process.env.HIPPOCAMPUS_LAUNCH = String(Date.now())
// The agent registrar only exists in the packaged app; running from source,
// the agents still come from `npm run install:agent`.
const REGISTRAR = path.join(process.resourcesPath ?? '', '..', 'MacOS', 'hippocampus-agents')

/**
 * Calls the registrar and hands back what it printed.
 *
 * It speaks JSON for `status` and plain text for the other commands. A failure
 * becomes `null` rather than an exception: the app has to open even with the
 * agents in a mess, or the one screen that can fix them becomes unreachable.
 */
function agents(command) {
  return new Promise((resolve) => {
    if (!fs.existsSync(REGISTRAR)) return resolve(null)
    execFile(REGISTRAR, [command], { timeout: 15_000 }, (error, output) => {
      if (error && !output) return resolve(null)
      try {
        resolve(command === 'status' ? JSON.parse(output) : { output: String(output).trim() })
      } catch {
        resolve({ output: String(output).trim() })
      }
    })
  })
}
/**
 * Updates, the way Speakly takes them: electron-updater reads the latest
 * release on GitHub, downloads it in the background, and it is installed when
 * the person says so — or when the app next quits.
 *
 * The update is only as trustworthy as its signature: on macOS the updater
 * checks that the downloaded app carries the same Developer ID as this one,
 * and that check is never turned off. Speakly turns it off for ad-hoc builds;
 * this app is always signed, so there is no case for it.
 *
 * No release with a build attached yet means the check fails with a 404, and
 * that is not an error anyone should see: it is logged and left alone.
 */
const UPDATES = { owner: 'rodolfobortolin', repo: 'hippocampus' }
let updateReady = null

function startUpdates() {
  if (!app.isPackaged) return
  let autoUpdater
  try {
    ;({ autoUpdater } = require('electron-updater'))
  } catch (error) {
    console.warn('[update] electron-updater is missing:', error.message)
    return
  }
  // The updater reads app-update.yml from the bundle before it downloads
  // anything, feed or no feed. A build that lacks it — v0.3.0 did — gets one
  // written beside its data instead, so it can still reach the fix.
  const bundled = path.join(process.resourcesPath, 'app-update.yml')
  if (!fs.existsSync(bundled)) {
    const own = path.join(app.getPath('userData'), 'app-update.yml')
    try {
      fs.writeFileSync(own, `provider: github\nowner: ${UPDATES.owner}\nrepo: ${UPDATES.repo}\nupdaterCacheDirName: hippocampus-updater\n`)
      autoUpdater.updateConfigPath = own
    } catch (error) {
      console.warn('[update] could not write app-update.yml:', error.message)
    }
  }
  autoUpdater.setFeedURL({ provider: 'github', ...UPDATES })
  // Downloaded by hand rather than automatically: the automatic download is a
  // promise nobody holds, and its failures surfaced as unhandled rejections.
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.logger = null
  autoUpdater.on('update-available', (info) => {
    console.log(`[update] ${info.version} available; downloading`)
    autoUpdater.downloadUpdate().catch((error) => console.warn('[update] download failed:', String(error?.message ?? error)))
  })
  autoUpdater.on('update-downloaded', (info) => {
    updateReady = info.version
    console.log(`[update] ${info.version} downloaded; it installs on restart`)
    tray?.setContextMenu(trayMenu())
  })
  autoUpdater.on('error', (error) => console.warn('[update]', String(error?.message ?? error).split('\n')[0]))
  const check = () => autoUpdater.checkForUpdates().catch(() => {})
  setTimeout(check, 15_000)
  setInterval(check, 4 * 60 * 60 * 1000)
  startUpdates.install = () => autoUpdater.quitAndInstall(false, true)
}

/**
 * After an update the agents are still running the old code: the collector,
 * the focus helper and the listener are launchd's processes, not this one,
 * and replacing the files under a running Node process leaves it serving the
 * old version with new files on disk, half and half. So when this app starts
 * as a version the agents have not seen, it restarts them once.
 */
const AGENT_LABELS = ['com.hippocampus.collector', 'com.hippocampus.focus', 'com.hippocampus.listener']
function restartAgentsAfterUpdate() {
  if (!app.isPackaged) return
  const seen = path.join(app.getPath('userData'), 'agents-version')
  let last = ''
  try { last = fs.readFileSync(seen, 'utf8').trim() } catch {}
  const now = app.getVersion()
  if (last === now) return
  // The first run of an install has nothing to restart; only a change does.
  if (last) {
    for (const label of AGENT_LABELS) {
      execFile('/bin/launchctl', ['kickstart', '-k', `gui/${process.getuid()}/${label}`], () => {})
    }
    console.log(`[update] ${last} → ${now}: agents restarted`)
  }
  try { fs.writeFileSync(seen, now) } catch {}
}

// Where the floating core was left last time. Kept outside the database on
// purpose: Electron starts before the core, and the window cannot wait for it.
const WINDOW_MEMORY = path.join(app.getPath('userData'), 'core.json')

let mainWindow = null
let coreWindow = null
let tray = null
let core = null
let watcher = null

function rememberedPosition() {
  try {
    return JSON.parse(fs.readFileSync(WINDOW_MEMORY, 'utf8'))
  } catch {
    return null
  }
}

function storePosition() {
  if (!coreWindow) return
  const [x, y] = coreWindow.getPosition()
  try {
    fs.writeFileSync(WINDOW_MEMORY, JSON.stringify({ x, y }))
  } catch {
    // Losing the position is annoying, not fatal.
  }
}

/** Reads the stored settings from the core. `null` when it is not up yet. */
function storedSettings() {
  return new Promise((resolve) => {
    const request = http.get(`http://127.0.0.1:${PORT}/api/settings`, { timeout: 1500 }, (response) => {
      let body = ''
      response.on('data', (piece) => { body += piece })
      response.on('end', () => {
        try { resolve(JSON.parse(body)) } catch { resolve(null) }
      })
    })
    request.on('error', () => resolve(null))
    request.on('timeout', () => { request.destroy(); resolve(null) })
  })
}

/**
 * The shortcut that calls the core, as chosen on the Settings screen.
 *
 * Registering is all-or-nothing and macOS gives no reason when it refuses, so
 * the answer goes back to the screen that asked: a combination another app
 * already holds has to say so there, not fail in silence and leave the person
 * pressing keys that do nothing.
 */
let callShortcut = ''
function useShortcut(accelerator) {
  const wanted = String(accelerator ?? '').trim()
  if (callShortcut && callShortcut !== wanted) {
    globalShortcut.unregister(callShortcut)
    callShortcut = ''
  }
  if (!wanted) return { ok: true, shortcut: '' }
  if (globalShortcut.isRegistered(wanted)) return { ok: true, shortcut: wanted }
  let ok = false
  try {
    ok = globalShortcut.register(wanted, shortcutCore)
  } catch {
    // An accelerator Electron cannot parse throws instead of returning false.
    ok = false
  }
  if (ok) callShortcut = wanted
  return { ok, shortcut: ok ? wanted : '' }
}

function coreAnswers() {
  return new Promise((resolve) => {
    const request = http.get(`http://127.0.0.1:${PORT}/api/status`, { timeout: 1200 }, (response) => {
      response.resume()
      resolve(response.statusCode === 200)
    })
    request.on('error', () => resolve(false))
    request.on('timeout', () => { request.destroy(); resolve(false) })
  })
}

/** Starts the core only if nobody is measuring yet — launchd's agent wins. */
async function ensureCore() {
  if (await coreAnswers()) return
  // Node runs TypeScript natively: one process, without the tsx wrapper (which
  // survived shutdown and left an orphaned collector behind).
  core = spawn(process.execPath, [
    '--experimental-strip-types',
    '--disable-warning=ExperimentalWarning',
    path.join(ROOT, 'core', 'index.ts'),
  ], {
    cwd: ROOT,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    stdio: 'ignore',
  })
  core.unref()
  for (let attempt = 0; attempt < 25; attempt++) {
    await new Promise((r) => setTimeout(r, 400))
    if (await coreAnswers()) return
  }
}

function openWindow() {
  if (mainWindow) {
    mainWindow.show()
    mainWindow.focus()
    return
  }
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    show: false,
    title: 'Hippocampus',
    backgroundColor: '#07080a',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 18 },
    vibrancy: 'under-window',
    visualEffectState: 'active',
    webPreferences: { contextIsolation: true, nodeIntegration: false, preload: PRELOAD },
  })

  mainWindow.loadURL(ADDRESS)
  mainWindow.once('ready-to-show', () => mainWindow.show())
  mainWindow.on('closed', () => { mainWindow = null })

  // An external link opens in the browser, not inside the app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

/**
 * The floating core: a frameless window, always on top, with just the sphere.
 *
 * It is the app when you do not want the app — it sits in a corner over
 * whatever you are doing, listens with a click and answers out loud. Closing
 * the panel ends nothing; this window and the collector carry on by themselves.
 */
function openCore(takeFocus = true) {
  if (coreWindow) {
    if (takeFocus) {
      coreWindow.show()
      coreWindow.focus()
    } else {
      coreWindow.showInactive()
    }
    return
  }

  const area = screen.getPrimaryDisplay().workArea
  const width = 260
  const height = 330
  // Back where it was. If the monitor it lived on is gone, Electron would
  // place the window out of sight — hence the check.
  const remembered = rememberedPosition()
  const visible = remembered && screen.getAllDisplays().some(({ workArea: a }) =>
    remembered.x + width > a.x && remembered.x < a.x + a.width &&
    remembered.y + height > a.y && remembered.y < a.y + a.height)

  coreWindow = new BrowserWindow({
    width: width,
    height: height,
    x: visible ? remembered.x : area.x + area.width - width - 24,
    y: visible ? remembered.y : area.y + area.height - height - 24,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, preload: PRELOAD },
  })

  // Above full screen too: it does not vanish when you enter a full-screen app.
  coreWindow.setAlwaysOnTop(true, 'floating')
  coreWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  coreWindow.loadURL(`${ADDRESS}#core`)
  coreWindow.once('ready-to-show', () =>
    takeFocus ? coreWindow.show() : coreWindow.showInactive())
  coreWindow.on('moved', storePosition)
  coreWindow.on('closed', () => { coreWindow = null })
}

/**
 * Brings the core to the front and tells it to listen.
 *
 * This is what the wake word and the shortcut do: the sphere appears where you
 * left it, already listening, without stealing focus from what you were doing —
 * which is why `showInactive` and not `show`.
 */
function callCore({ wordHeard = false } = {}) {
  const isNew = !coreWindow
  openCore(false)
  const wake = () => coreWindow?.webContents.send('core:wake')
  if (isNew) coreWindow.webContents.once('did-finish-load', wake)
  // The wake word also reaches a window that already exists through its own
  // socket. Telling it again here toggles it twice — the live session opened
  // and, still connecting, closed on the same word.
  else if (!wordHeard) wake()
}

/**
 * The pointer: one transparent window laid over the display it points into.
 *
 * It never takes a click or focus, and it sits above full-screen apps. It is
 * hidden between uses rather than closed, so the next point does not wait
 * for a page to load. The screen helper leaves it out of screenshots, being
 * one of this app's windows.
 */
let pointerWindow = null
let pointerTimer
function pointAt({ x, y, label }) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return
  const display = screen.getDisplayNearestPoint({ x, y })
  const bounds = display.bounds
  if (!pointerWindow || pointerWindow.isDestroyed()) {
    pointerWindow = new BrowserWindow({
      ...bounds,
      frame: false,
      transparent: true,
      hasShadow: false,
      resizable: false,
      movable: false,
      focusable: false,
      skipTaskbar: true,
      show: false,
      type: 'panel',
      enableLargerThanScreen: true,
      webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
    })
    pointerWindow.setIgnoreMouseEvents(true)
    pointerWindow.setAlwaysOnTop(true, 'screen-saver')
    pointerWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
    pointerWindow.loadFile(path.join(__dirname, 'pointer.html'))
  }
  pointerWindow.setBounds(bounds)

  const to = { x: x - bounds.x, y: y - bounds.y }
  const cursor = screen.getCursorScreenPoint()
  // From the cursor when it is on this display; otherwise from just above the
  // place, so the flight is still a short arrival and not a jump from nowhere.
  const from = screen.getDisplayNearestPoint(cursor).id === display.id
    ? { x: cursor.x - bounds.x, y: cursor.y - bounds.y }
    : { x: to.x, y: Math.max(0, to.y - 160) }
  const script = `fly(${JSON.stringify({ from, to, text: String(label ?? '').slice(0, 40) })})`
  const fly = () => pointerWindow?.webContents.executeJavaScript(script).catch(() => {})
  if (pointerWindow.webContents.isLoading()) pointerWindow.webContents.once('did-finish-load', fly)
  else fly()
  pointerWindow.showInactive()

  clearTimeout(pointerTimer)
  pointerTimer = setTimeout(() => {
    pointerWindow?.webContents.executeJavaScript('fade()').catch(() => {})
    pointerTimer = setTimeout(() => pointerWindow?.hide(), 260)
  }, 4200)
}

/** Listens to the core: the wake word, and where to point. */
function watchTheCore() {
  if (watcher) return
  watcher = new WebSocket(`ws://127.0.0.1:${PORT}/ws`, { origin: `http://127.0.0.1:${PORT}` })
  watcher.on('message', (raw) => {
    let event
    try { event = JSON.parse(String(raw)) } catch { return } // not JSON, not ours
    if (event.type === 'wake') callCore({ wordHeard: true })
    if (event.type === 'point') pointAt(event)
  })
  const reconnect = () => {
    watcher = null
    setTimeout(watchTheCore, 4000)
  }
  watcher.on('close', reconnect)
  watcher.on('error', reconnect)
}

/**
 * Hides rather than closes.
 *
 * Closing destroys the WebGL scene, and the wake word would then wait a second
 * or two for it to load before it could listen. Hidden, the window comes back
 * at once — and Chromium suspends `requestAnimationFrame` for a hidden window,
 * so the idle sphere costs nothing.
 */
function toggleCore() {
  if (coreWindow?.isVisible()) coreWindow.hide()
  else openCore()
}

/**
 * What the shortcut does: brings it over and starts listening, or sends it
 * away.
 *
 * A shortcut that only ever summons leaves the sphere sitting on the desktop
 * with no way out but the tray menu. The wake word keeps calling
 * unconditionally — someone who just said the word out loud means to talk, not
 * to dismiss.
 */
function shortcutCore() {
  if (coreWindow?.isVisible()) {
    coreWindow.hide()
    return
  }
  callCore()
}

/** The page asking to be sent away: its own Esc, and its close button. */
function hideCore() {
  coreWindow?.hide()
}

/** The chosen shortcut, written the way a macOS menu writes one. */
function menuAccelerator() {
  return callShortcut ? callShortcut.replace('CommandOrControl', 'Cmd') : undefined
}

/**
 * The menu bar's menu, apart from the icon: an update that finishes
 * downloading rebuilds the menu, and building the icon again would put a
 * second one in the menu bar.
 */
function trayMenu() {
  return Menu.buildFromTemplate([
    // Only when one is waiting: the one thing in the menu that is new.
    ...(updateReady ? [
      { label: `Restart to update to ${updateReady}`, click: () => startUpdates.install?.() },
      { type: 'separator' },
    ] : []),
    { label: 'Open Hippocampus', click: openWindow },
    { label: 'Floating core', accelerator: 'Cmd+Shift+H', click: toggleCore },
    // The accelerator shown is whatever is registered right now, not the one
    // this line was written with.
    { label: 'Talk to Hippocampus', accelerator: menuAccelerator(), click: callCore },
    { type: 'separator' },
    {
      label: 'Close yesterday',
      click: () => {
        const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
        http.request(`http://127.0.0.1:${PORT}/api/rollup?day=${yesterday}`, { method: 'POST' }).end()
      },
    },
    { label: 'Open the data folder', click: () => shell.openPath(
      path.join(app.getPath('appData'), 'Hippocampus')) },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ])
}

function buildTray() {
  // Vite copies public/ into dist/ when it builds, and only dist/ goes into
  // the package: in the installed app the image lives there. Reading public/
  // worked in development and left the installed app with an empty image —
  // a menu bar item that could be clicked and could not be seen.
  const icon = nativeImage.createFromPath(
    path.join(ROOT, app.isPackaged ? 'dist' : 'public', 'trayTemplate.png'))
  icon.setTemplateImage(true)
  tray = new Tray(icon)
  if (icon.isEmpty()) {
    // Never invisible again: a mark in the menu bar is better than a hole.
    console.error('[tray] trayTemplate.png not found; showing a text mark instead')
    tray.setTitle('◉')
  }
  tray.setToolTip('Hippocampus — measuring')
  tray.setContextMenu(trayMenu())
  tray.on('click', openWindow)
}

app.whenReady().then(async () => {
  // Without this Electron denies getUserMedia silently and the microphone just
  // seems not to work. Only the interface itself, on 127.0.0.1, is served; any
  // other origin stays denied.
  session.defaultSession.setPermissionRequestHandler((conteudo, permissao, permitir) => {
    const origem = new URL(conteudo.getURL()).hostname
    const local = origem === '127.0.0.1' || origem === 'localhost'
    permitir(local && (permissao === 'media' || permissao === 'audioCapture'))
  })

  // The Dock icon comes from the .icns, which carries every resolution; the
  // menu bar one is a monochrome mask, recoloured by the system itself. The
  // installed app already carries it in its bundle — build/ is not packaged —
  // so this only matters when running from the source.
  if (process.platform === 'darwin' && !app.isPackaged) {
    app.dock?.setIcon(nativeImage.createFromPath(path.join(ROOT, 'build', 'icon.icns')))
  }
  // The folder picker — the vault, the code. It lives in the main process
  // because only that one has access to the file system and to the macOS
  // dialogs. The page passes the sentence to show, already in its language.
  ipcMain.handle('choose-folder', async (_event, message) => {
    const choice = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      message: typeof message === 'string' && message ? message : 'Choose a folder',
    })
    return choice.canceled ? null : choice.filePaths[0] ?? null
  })

  // Dragging the sphere moves the window. `-webkit-app-region: drag` will not
  // do here: it swallows the click, and the click is how you talk to the core.
  ipcMain.on('core:move', (_event, { dx, dy }) => {
    if (!coreWindow) return
    const [x, y] = coreWindow.getPosition()
    coreWindow.setPosition(Math.round(x + dx), Math.round(y + dy))
  })
  ipcMain.on('core:settle', storePosition)
  ipcMain.on('core:hide', hideCore)

  // The Accessibility pane of System Settings. Without that permission the
  // helper sees which app is in front but not the window title.
  ipcMain.handle('open-accessibility', () =>
    shell.openExternal(
      'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility'))

  // Measuring the day is what the app is for, but turning on an agent that
  // starts at login is the user's decision — and macOS asks them to approve it.
  // So it lives on the Settings screen, not in a silent first-run registration.
  // The Settings screen hands the shortcut over the moment it changes, so the
  // new combination works without restarting the app.
  ipcMain.handle('shortcut:set', (_event, accelerator) => useShortcut(accelerator))

  ipcMain.handle('update:status', () => ({ version: app.getVersion(), ready: updateReady }))
  ipcMain.handle('update:install', () => startUpdates.install?.())

  ipcMain.handle('agents:status', () => agents('status'))
  ipcMain.handle('agents:register', () => agents('register'))
  ipcMain.handle('agents:unregister', () => agents('unregister'))

  restartAgentsAfterUpdate()
  await ensureCore()
  buildTray()
  startUpdates()
  openWindow()
  watchTheCore()
  // Calling the core from anywhere, without hunting for the app. A shortcut
  // already taken by another app fails silently, and the symptom would be "the
  // shortcut does not work" with no clue at all — hence the warning.
  if (!globalShortcut.register('CommandOrControl+Shift+H', toggleCore)) {
    console.warn('[shortcut] CommandOrControl+Shift+H is already taken by another app')
  }
  const settings = await storedSettings()
  const chosen = settings?.shortcut ?? 'CommandOrControl+Shift+Space'
  if (!useShortcut(chosen).ok) {
    console.warn(`[shortcut] ${chosen} is already taken by another app`)
  }
})

app.on('activate', openWindow)
// The app lives in the menu bar: closing the window does not end the measuring.
app.on('window-all-closed', () => {})
app.on('before-quit', () => {
  globalShortcut.unregisterAll()
  watcher?.close()
  // The floating window is always on top and visible on every space, so a
  // quit that leaves it behind leaves a sphere hovering over a desktop with
  // nothing running underneath it.
  coreWindow?.destroy()
  coreWindow = null
  if (core) core.kill()
})
