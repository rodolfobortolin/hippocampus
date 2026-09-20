// Assina o registrador de agentes com a identidade do app, e resela o app.
//
// O SMAppService recusa registrar um agente quando quem pede não é o próprio
// app — e "ser o app" aqui é literal: ele compara o identificador da
// assinatura. O electron-builder assina binários aninhados usando o nome do
// arquivo (`hipocampo-agentes`), e o registro falhava com um seco "Operation
// not permitted", sem dizer por quê.
//
// Roda no afterSign, e não no afterPack, porque a assinatura do app reassina os
// binários aninhados depois — uma correção feita antes seria desfeita. Como
// trocar a assinatura de dentro rompe o selo de fora, o app é resselado aqui
// mesmo, com o runtime endurecido e os mesmos entitlements, para continuar
// notarizável.
const { execFileSync } = require('node:child_process')
const path = require('node:path')
const fs = require('node:fs')

function identidade() {
  return execFileSync('security', ['find-identity', '-v', '-p', 'codesigning'], { encoding: 'utf8' })
    .split('\n').find((l) => l.includes('Developer ID Application'))
    ?.replace(/.*"(.*)".*/, '$1')
}

exports.default = async function assinaRegistrador(contexto) {
  const app = path.join(contexto.appOutDir, `${contexto.packager.appInfo.productFilename}.app`)
  const registrador = path.join(app, 'Contents', 'MacOS', 'hipocampo-agentes')
  if (!fs.existsSync(registrador)) return

  const quem = identidade()
  const entitlements = path.join(__dirname, 'entitlements.mac.plist')
  const comuns = ['--force', '--options', 'runtime']
  const assinatura = quem ? ['--timestamp', '--sign', quem] : ['--sign', '-']

  execFileSync('codesign', [...comuns, '--identifier', 'com.hipocampo.app', ...assinatura, registrador])
  execFileSync('codesign', [...comuns, '--entitlements', entitlements, ...assinatura, app])

  // Se o selo não fechar, o app não abre — melhor quebrar o build aqui.
  execFileSync('codesign', ['--verify', '--strict', app])
  console.log(`  • registrador assinado como com.hipocampo.app e app resselado${quem ? '' : ' (ad hoc)'}`)
}
