import { readFileSync } from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vite'

// The version comes from package.json, the one place the app writes it. The
// page says %VERSION% wherever it needs the number, so the button to the
// release notes can never point at an older release than the one out.
const { version } = JSON.parse(readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'))

// The project's website. It lives beside the app and borrows the one thing it
// could not do without — the core, straight from src/three — so the sphere on
// the page is the sphere in the app, not a drawing of it.
export default defineConfig({
  root: __dirname,
  // Relative paths, so the built site works from any folder or subpath.
  base: './',
  build: { outDir: 'dist', emptyOutDir: true },
  server: { port: 5180 },
  plugins: [{
    name: 'version',
    transformIndexHtml: (html) => html.replaceAll('%VERSION%', version),
  }],
})
