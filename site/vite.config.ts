import { readFileSync } from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vite'

// The version comes from package.json, the one place the app writes it. The
// page says %VERSION% wherever it needs the number, so the button to the
// release notes can never point at an older release than the one out.
const { version, funding } = JSON.parse(readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'))

// Where the site lives. Every tag that has to be an absolute address — the
// canonical link, the link previews, the sitemap — is written from this one
// line, so moving the site is a change here and nowhere else.
export const SITE = 'https://rodolfobortolin.github.io/hippocampus/'

// The lunch link comes from the same file. Until there is one, the block that
// offers it is left out of the page entirely: a button that leads nowhere is
// worse than no button.
const lunch: string = funding?.url ?? ''
const withLunch = (html: string) => lunch
  ? html.replaceAll('%LUNCH%', lunch)
  : html.replace(/<!-- lunch -->[\s\S]*?<!-- \/lunch -->/g, '')

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
    transformIndexHtml: (html) => withLunch(html.replaceAll('%VERSION%', version).replaceAll('%SITE%', SITE)),
    // The two files crawlers ask for first, written from the same address.
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: `User-agent: *\nAllow: /\n\nSitemap: ${SITE}sitemap.xml\n` })
      this.emitFile({
        type: 'asset', fileName: 'sitemap.xml',
        source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`
          + `  <url><loc>${SITE}</loc><lastmod>${new Date().toISOString().slice(0, 10)}</lastmod></url>\n</urlset>\n`,
      })
    },
  }],
})
