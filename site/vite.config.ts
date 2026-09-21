import { defineConfig } from 'vite'

// The project's website. It lives beside the app and borrows the one thing it
// could not do without — the core, straight from src/three — so the sphere on
// the page is the sphere in the app, not a drawing of it.
export default defineConfig({
  root: __dirname,
  // Relative paths, so the built site works from any folder or subpath.
  base: './',
  build: { outDir: 'dist', emptyOutDir: true },
  server: { port: 5180 },
})
