// The bridge between the interface and macOS.
//
// Only what the app needs crosses over: picking a folder, dragging the core's
// window, and hearing when the wake word called. No loose `require` in the
// renderer — the page is served over HTTP, and whatever it can do to the
// system has to fit in this list.
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('hippocampus', {
  /** When this run of the app started. The opening plays once per launch. */
  launchedAt: process.env.HIPPOCAMPUS_LAUNCH ?? '',

  /** Opens the system folder picker. Null when the person backs out. */
  chooseFolder: (message) => ipcRenderer.invoke('choose-folder', message),

  /** Opens the Accessibility pane of System Settings. */
  openAccessibility: () => ipcRenderer.invoke('open-accessibility'),

  /**
   * Sets the shortcut that calls the core. Answers `{ ok }` — false when
   * another app already holds that combination.
   */
  setShortcut: (accelerator) => ipcRenderer.invoke('shortcut:set', accelerator),

  /** Moves the floating window by screen pixels — this is the sphere's drag. */
  moveCore: (dx, dy) => ipcRenderer.send('core:move', { dx, dy }),

  /** Signals that the drag ended, so the position gets stored. */
  settleCore: () => ipcRenderer.send('core:settle'),

  /** Sends the floating window away — its own Esc and its close button. */
  hideCore: () => ipcRenderer.send('core:hide'),

  /** The state of the agents that measure the day, and how to switch them. */
  agents: {
    status: () => ipcRenderer.invoke('agents:status'),
    register: () => ipcRenderer.invoke('agents:register'),
    unregister: () => ipcRenderer.invoke('agents:unregister'),
  },

  /** Called when the wake word or the shortcut brought the core over. */
  onWake: (callback) => {
    const listener = () => callback()
    ipcRenderer.on('core:wake', listener)
    return () => ipcRenderer.removeListener('core:wake', listener)
  },
})
