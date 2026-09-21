// Writes latest-mac.yml, the file the app's updater reads from the newest
// GitHub release to learn what is there to download.
//
//   node scripts/update-manifest.mjs <folder> <version> <zip> [dmg]
//
// electron-builder writes this file itself when it publishes, but the release
// is packed by scripts/notarize.sh from an app notarised after electron-builder
// is done with it (see the note there), so the manifest is written here, from
// the files as they will be uploaded. The updater refuses a download whose
// sha512 does not match, so the numbers have to come from the final bytes.

import { createHash } from 'node:crypto'
import { readFileSync, statSync } from 'node:fs'
import path from 'node:path'

const [folder, version, zip, dmg] = process.argv.slice(2)
if (!folder || !version || !zip) {
  console.error('usage: node scripts/update-manifest.mjs <folder> <version> <zip> [dmg]')
  process.exit(1)
}

const describe = (name) => {
  const file = path.join(folder, name)
  return {
    url: name,
    sha512: createHash('sha512').update(readFileSync(file)).digest('base64'),
    size: statSync(file).size,
  }
}

// The zip first: on macOS the updater installs the zip, and the .dmg is only
// listed so the manifest describes the whole release.
const files = [zip, dmg].filter(Boolean).map(describe)
const lines = [
  `version: ${version}`,
  'files:',
  ...files.flatMap((f) => [`  - url: ${f.url}`, `    sha512: ${f.sha512}`, `    size: ${f.size}`]),
  `path: ${files[0].url}`,
  `sha512: ${files[0].sha512}`,
  `releaseDate: '${new Date().toISOString()}'`,
]
process.stdout.write(lines.join('\n') + '\n')
