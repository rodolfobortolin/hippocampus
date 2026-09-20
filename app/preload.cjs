// A ponte entre a interface e o macOS.
//
// Só o que o app precisa atravessa: escolher uma pasta, arrastar a janela do
// núcleo e ouvir quando a palavra de ativação chamou. Nada de `require` solto
// no renderizador — a página é servida por HTTP, e o que ela pode fazer com o
// sistema tem que caber nesta lista.
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('hippocampus', {
  /** Abre o seletor de pastas do sistema. Devolve null se a pessoa desistir. */
  chooseFolder: () => ipcRenderer.invoke('choose-folder'),

  /** Move a janela flutuante em pixels de tela — é o arrasto da esfera. */
  moveCore: (dx, dy) => ipcRenderer.send('core:move', { dx, dy }),

  /** Avisa que o arrasto terminou, para a posição ser guardada. */
  settleCore: () => ipcRenderer.send('core:settle'),

  /** O estado dos agents que medem o dia, e como ligá-los ou desligá-los. */
  agents: {
    status: () => ipcRenderer.invoke('agents:estado'),
    register: () => ipcRenderer.invoke('agents:registrar'),
    desregister: () => ipcRenderer.invoke('agents:desregistrar'),
  },

  /** Chamado quando a palavra de ativação ou o atalho trouxe o núcleo. */
  onWake: (callback) => {
    const listener = () => callback()
    ipcRenderer.on('core:wake', listener)
    return () => ipcRenderer.removeListener('core:wake', listener)
  },
})
