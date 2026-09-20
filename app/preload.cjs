// The bridge between the interface and macOS.
//
// Only what the app needs crosses over: picking a folder, dragging the core's
// window, and hearing when the wake word called. No loose `require` in the
// renderer — the page is served over HTTP, and whatever it can do to the
// system has to fit in this list.
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('hippocampus', {
  /** Abre o seletor de pastas do sistema. Devolve null se a pessoa desistir. */
  chooseFolder: () => ipcRenderer.invoke('choose-folder'),

  /** Moves the floating window by screen pixels — this is the sphere's drag. */
  moveCore: (dx, dy) => ipcRenderer.send('core:move', { dx, dy }),

  /** Signals that the drag ended, so the position gets stored. */
  settleCore: () => ipcRenderer.send('core:settle'),

  /** The state of the agents that measure the day, and how to switch them. */
  agents: {
    status: () => ipcRenderer.invoke('agents:estado'),
    register: () => ipcRenderer.invoke('agents:registrar'),
    desregister: () => ipcRenderer.invoke('agents:desregistrar'),
  },

  /** Called when the wake word or the shortcut brought the core over. */
  onWake: (callback) => {
    const listener = () => callback()
    ipcRenderer.on('core:wake', listener)
    return () => ipcRenderer.removeListener('core:wake', listener)
  },
})
