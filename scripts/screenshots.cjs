// Photographs the app for the website, running over the demo database.
//
// Start the demo core first (see scripts/demo-core.ts), then:
//   npx electron scripts/screenshots.cjs /tmp/shots
//
// It writes PNGs; the website takes them as WebP in site/public/img.
//
// It opens the interface the demo core serves, pointed at that core with
// `?core=`, so nothing real is on screen: the real core and the real data are
// never touched. Electron is already a dependency, and capturing its own window
// needs no screen-recording permission — which a screenshot tool would.

const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

const OUT = path.resolve(process.argv[2] ?? path.join(require('node:os').tmpdir(), 'hippocampus-shots'))
const PORT = Number(process.env.DEMO_PORT ?? 7979)
const ADDRESS = `http://127.0.0.1:${PORT}/?core=${PORT}`

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function shoot(win, name) {
  const image = await win.webContents.capturePage()
  fs.writeFileSync(path.join(OUT, `${name}.png`), image.toPNG())
  const { width, height } = image.getSize()
  console.log(`  ${name}.png  ${width}×${height}`)
}

/** Clicks the first button whose text is exactly this — the tabs, mostly. */
const click = (win, label) => win.webContents.executeJavaScript(`
  (() => {
    const button = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === ${JSON.stringify(label)})
    if (button) button.click()
    return Boolean(button)
  })()
`)

/**
 * Refuses to photograph anything but the demo.
 *
 * The core it points at is whatever answers on that port, and a core started
 * by hand inherits the repository's `.env` — which names the real vault. A run
 * like that photographed a screen listing real client names, one step away
 * from a public page. The demo's person is Alex; anyone else and this stops.
 */
async function demoOnly() {
  const response = await fetch(`http://127.0.0.1:${PORT}/api/status`).catch(() => null)
  if (!response || !response.ok) {
    console.error(`No core answering on ${PORT}. Start scripts/demo-core.ts first.`)
    process.exit(1)
  }
  const status = await response.json()
  if (status.user !== 'Alex' || status.language !== 'en-US') {
    console.error(`The core on ${PORT} is not the demo (it answers as "${status.user}", ${status.language}).`)
    console.error('Start it with: HIPPOCAMPUS_DATA=/tmp/hippocampus-demo HIPPOCAMPUS_PORT=7979 node --experimental-strip-types scripts/demo-core.ts')
    process.exit(1)
  }
}

app.whenReady().then(async () => {
  await demoOnly()
  fs.mkdirSync(OUT, { recursive: true })
  // Sharper than the screen it runs on. Off every display a window renders at
  // 1x, which is soft on a Retina screen; so the window is made 2560 pixels
  // wide — macOS will not go wider than the display even when asked to be
  // larger than the screen — and zoomed until the page lays out at 1440 CSS
  // pixels, the width the app was designed at. Every glyph comes out at 1.78×.
  // (Device emulation hangs a window that sits off every display, and a zoom
  // set in webPreferences hangs the first load; zooming after it does not.)
  const WIDTH = 2560
  const win = new BrowserWindow({
    width: WIDTH, height: 1600, show: true, x: -6000, y: 0, enableLargerThanScreen: true,
    backgroundColor: '#07080a',
    webPreferences: { backgroundThrottling: false },
  })

  // The opening video would sit on top of the first shot; mark it seen.
  await win.loadURL(ADDRESS)
  await win.webContents.executeJavaScript(`localStorage.setItem('hippocampus.intro', String(Date.now() + 86400000))`)
  win.webContents.setZoomFactor(WIDTH / 1440)

  await win.loadURL(ADDRESS)
  await wait(3500)
  await shoot(win, 'today')

  await click(win, 'Rhythm')
  await wait(2500)
  await shoot(win, 'rhythm')

  // The same screen with a cell picked, which is the part people ask about.
  // Thursday at 16h, on purpose: the website's text names that slot, so the
  // picture has to show it. And every cell is told the pointer left, because a
  // stray hover leaves "Fri at 23h · 0min" written over the map otherwise.
  await win.webContents.executeJavaScript(`
    (() => {
      const cells = [...document.querySelectorAll('.heatmap svg rect')]
      const thursdayAtFour = cells[4 * 24 + 16]
      thursdayAtFour.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      document.querySelector('.heatmap').closest('.panel').scrollIntoView({ block: 'start' })
    })()
  `)
  // The window keeps a pointer of its own, and after the scroll it rests on
  // some cell and writes that cell's hover over the map. Park it on the
  // sidebar, where nothing reacts to it.
  win.webContents.sendInputEvent({ type: 'mouseMove', x: 20, y: 700 })
  await wait(2500)
  await shoot(win, 'rhythm-filtered')

  // The pieces of work, over the last week: a week is covered by the focus
  // samples, so the screen shows time rather than counting visits.
  await click(win, 'Work')
  await wait(2000)
  await click(win, '7 days')
  await wait(2500)
  win.webContents.sendInputEvent({ type: 'mouseMove', x: 20, y: 700 })
  await shoot(win, 'work')

  // The notes: the composer at the top, and under it what the close of the
  // last day kept on its own. The demo vault is written by demo-data.ts.
  await click(win, 'Notes')
  await wait(2500)
  await shoot(win, 'notes')

  await click(win, 'Journal')
  await wait(2000)
  await shoot(win, 'journal')

  // A real question, answered by Claude Code over the demo database.
  await click(win, 'Chat')
  await wait(2500)
  await shoot(win, 'chat-empty')
  await win.webContents.executeJavaScript(`
    (() => {
      const button = [...document.querySelectorAll('.chat-shortcuts button')][1]
      if (button) button.click()
    })()
  `)
  for (let i = 0; i < 60; i++) {
    await wait(1000)
    const done = await win.webContents.executeJavaScript(`!document.querySelector('.tool') && document.querySelectorAll('.message.theirs').length > 0`)
    if (done) break
  }
  await wait(1500)
  // The question at the top and the start of the answer under it.
  await win.webContents.executeJavaScript(`document.querySelector('.thread')?.scrollTo({ top: 0 })`)
  await wait(600)
  await shoot(win, 'chat')

  app.quit()
})
