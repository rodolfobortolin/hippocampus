import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App.tsx'
import { FloatingCore } from './FloatingCore.tsx'
import { LanguageProvider } from './lib/language.tsx'
import { Intro } from './components/Intro.tsx'
import './styles.css'

// Two faces of the same app, served from the same address: the whole panel and
// the floating core, which Electron's frameless window opens with #core.
const floating = window.location.hash === '#core'
if (floating) document.body.dataset.mode = 'floating'

createRoot(document.getElementById('raiz')!).render(
  <StrictMode>
    <LanguageProvider>
      {floating ? <FloatingCore /> : <><Intro /><App /></>}
    </LanguageProvider>
  </StrictMode>,
)
