import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'

/**
 * Nenhuma fonte pode tocar o disco de forma síncrona.
 *
 * Isto já foi resolvido uma vez, no `skysight.ts`, e voltou nas outras fontes —
 * é o tipo de regra que só sobrevive se alguém verificar. O custo de quebrá-la
 * é alto e o sintoma é mudo: numa pasta protegida pelo macOS a chamada não dá
 * erro, ela para, e para o coletor inteiro junto. O servidor diz "de pé" e
 * nenhuma rota responde.
 */
const PROIBIDAS = [
  'readdirSync', 'readFileSync', 'existsSync', 'statSync', 'lstatSync',
  'openSync', 'readSync', 'closeSync', 'writeFileSync', 'accessSync',
]

test('nenhuma fonte de dados lê disco de forma síncrona', async () => {
  const dir = path.join(import.meta.dirname, '..', 'core', 'sources')
  const problemas: string[] = []

  for (const nome of await fs.readdir(dir)) {
    if (!nome.endsWith('.ts')) continue
    const texto = await fs.readFile(path.join(dir, nome), 'utf8')
    texto.split('\n').forEach((linha, i) => {
      // Comentário citando o nome da função é como este arquivo documenta a
      // regra; o que importa é a chamada.
      const semComentario = linha.replace(/\/\/.*$/, '').replace(/^\s*\*.*$/, '')
      for (const proibida of PROIBIDAS) {
        if (semComentario.includes(`${proibida}(`)) {
          problemas.push(`${nome}:${i + 1} usa ${proibida}`)
        }
      }
    })
  }

  assert.deepEqual(problemas, [],
    `disco síncrono numa fonte congela o coletor inteiro:\n  ${problemas.join('\n  ')}`)
})
