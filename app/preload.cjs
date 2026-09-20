// A ponte entre a interface e o macOS.
//
// Só o que o app precisa atravessa: escolher uma pasta, arrastar a janela do
// núcleo e ouvir quando a palavra de ativação chamou. Nada de `require` solto
// no renderizador — a página é servida por HTTP, e o que ela pode fazer com o
// sistema tem que caber nesta lista.
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('hipocampo', {
  /** Abre o seletor de pastas do sistema. Devolve null se a pessoa desistir. */
  escolherPasta: () => ipcRenderer.invoke('escolher-pasta'),

  /** Move a janela flutuante em pixels de tela — é o arrasto da esfera. */
  moveNucleo: (dx, dy) => ipcRenderer.send('nucleo:mover', { dx, dy }),

  /** Avisa que o arrasto terminou, para a posição ser guardada. */
  fixaNucleo: () => ipcRenderer.send('nucleo:fixar'),

  /** Chamado quando a palavra de ativação ou o atalho trouxe o núcleo. */
  aoAcordar: (callback) => {
    const ouvinte = () => callback()
    ipcRenderer.on('nucleo:acordar', ouvinte)
    return () => ipcRenderer.removeListener('nucleo:acordar', ouvinte)
  },
})
