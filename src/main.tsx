import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App.tsx'
import { NucleoSolto } from './NucleoSolto.tsx'
import './styles.css'

// Duas caras do mesmo app, servidas pelo mesmo endereço: o painel inteiro e o
// núcleo solto, que a janela flutuante do Electron abre com #nucleo.
const solto = window.location.hash === '#nucleo'
if (solto) document.body.dataset.modo = 'solto'

createRoot(document.getElementById('raiz')!).render(
  <StrictMode>{solto ? <NucleoSolto /> : <App />}</StrictMode>,
)
