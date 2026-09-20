// Signs the agent registrar with the app's identity, then reseals the app.
//
// SMAppService refuses to register an agent when the one asking is not the app
// itself — and "being the app" is literal here: it compares the signature's
// identifier. electron-builder signs nested binaries using the filename
// (`hippocampus-agents`), and registration failed with a bare "Operation not
// permitted", with no hint as to why.
//
// It runs in afterSign rather than afterPack, because signing the app re-signs
// the nested binaries afterwards — a fix applied earlier would be undone. And
// because changing an inner signature breaks the outer seal, the app is
// resealed here too, with the hardened runtime and the same entitlements, so it
// stays notarisable.
const { execFileSync } = require('node:child_process')
const path = require('node:path')
const fs = require('node:fs')

function identity() {
  return execFileSync('security', ['find-identity', '-v', '-p', 'codesigning'], { encoding: 'utf8' })
    .split('\n').find((l) => l.includes('Developer ID Application'))
    ?.replace(/.*"(.*)".*/, '$1')
}

exports.default = async function signRegistrar(context) {
  const app = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`)
  const registrar = path.join(app, 'Contents', 'MacOS', 'hippocampus-agents')
  if (!fs.existsSync(registrar)) return

  const who = identity()
  const entitlements = path.join(__dirname, 'entitlements.mac.plist')
  const common = ['--force', '--options', 'runtime']
  const assinatura = who ? ['--timestamp', '--sign', quem] : ['--sign', '-']

  execFileSync('codesign', [...common, '--identifier', 'com.hippocampus.app', ...signature, registrador])
  execFileSync('codesign', [...common, '--entitlements', entitlements, ...signature, app])

  // If the seal does not close, the app does not open — better to break the build here.
  execFileSync('codesign', ['--verify', '--strict', app])
  console.log(`  • registrar signed as com.hippocampus.app and app resealed${who ? '' : ' (ad hoc)'}`)
}
