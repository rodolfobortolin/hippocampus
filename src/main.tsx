import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App.tsx'
import { FloatingCore } from './FloatingCore.tsx'
import { LanguageProvider } from './lib/language.tsx'
import './styles.css'

// Duas caras do mesmo app, servidas pelo mesmo endereço: o painel inteiro e o
// núcleo floating, que a janela flutuante do Electron abre com #nucleo.
const floating = window.location.hash === '#nucleo'
if (floating) document.body.dataset.modo = 'floating'

createRoot(document.getElementById('raiz')!).render(
  <StrictMode>
    <LanguageProvider>{floating ? <FloatingCore /> : <App />}</LanguageProvider>
  </StrictMode>,
)
