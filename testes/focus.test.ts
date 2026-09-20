import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// O banco é aberto na importação, a partir de config.dataDir. Apontar para uma
// pasta temporária ANTES de importar é o que mantém o teste longe dos dados
// reais de quem está rodando.
const temporaria = fs.mkdtempSync(path.join(os.tmpdir(), 'hipocampo-teste-'))
process.env.HIPOCAMPO_DATA = temporaria

const { FocusCollector } = await import('../core/sources/focus.ts')
const { db } = await import('../core/db.ts')

after(() => fs.rmSync(temporaria, { recursive: true, force: true }))

/** Uma amostra como o helper nativo entrega, com tudo preenchido. */
function amostra(extra: Record<string, unknown> = {}) {
  return {
    ts: new Date().toISOString(),
    idle: 0, locked: false, trusted: true,
    keys: 100, clicks: 10, scroll: 5,
    mic: true, som: true, escuta: false,
    midiaAberta: 'Music', tocando: 'Miles Davis — So What',
    tela: 'GP27-FQS',
    app: 'Code', bundle: 'com.microsoft.VSCode', title: 'focus.ts',
    ...extra,
  }
}

test('a coluna de cada valor existe: o insert grava tudo que o helper informa', () => {
  const coletor = new FocusCollector()
  // `push` engole o erro e só registra — num teste isso esconderia a falha.
  let falhou: unknown
  const erroOriginal = console.error
  console.error = (...args: unknown[]) => { falhou = args }
  coletor.push(amostra())
  console.error = erroOriginal
  assert.equal(falhou, undefined, `a ingestão falhou: ${String(falhou)}`)

  const bloco = db.prepare('select * from blocks order by id desc limit 1').get() as any
  assert.ok(bloco, 'nenhum bloco foi gravado')

  // Esta é a asserção que teria pego o bug: o insert tinha 14 colunas e recebia
  // 18 valores, e os quatro últimos — tela, som, midia, tocando — nunca eram
  // gravados. 887 blocos foram para o banco com os campos vazios.
  assert.equal(bloco.app, 'Code')
  assert.equal(bloco.tela, 'GP27-FQS')
  assert.equal(bloco.som, 1)
  assert.equal(bloco.mic, 1)
  assert.equal(bloco.tocando, 'Miles Davis — So What')
  assert.equal(bloco.midia, 'Music')
})

test('a mesma janela continua o mesmo bloco, e o som conhecido sobrevive', () => {
  const coletor = new FocusCollector()
  coletor.push(amostra({ ts: new Date(Date.now() - 4000).toISOString() }))
  const id = (db.prepare('select id from blocks order by id desc limit 1').get() as any).id

  // Mesma janela, mesma faixa, quatro segundos depois: o bloco é estendido.
  // O `som` vem falso desta vez — e não pode apagar o que já se sabia, porque
  // um bloco com som é um bloco com som, não um instante de silêncio.
  coletor.push(amostra({ som: false, keys: 150 }))
  const depois = db.prepare('select * from blocks where id = ?').get(id) as any

  assert.equal((db.prepare('select count(*) n from blocks where id > ?').get(id) as any).n, 0,
    'a segunda amostra criou um bloco novo em vez de estender o aberto')
  assert.equal(depois.som, 1, 'som já registrado foi apagado por uma amostra sem som')
  assert.equal(depois.keys, 50, 'o delta de teclas entre amostras não foi somado')
})

test('trocar de faixa começa um bloco novo', () => {
  // A faixa faz parte da identidade do bloco de propósito: "quarenta minutos
  // ouvindo isto" só é uma frase verdadeira se a troca separar os trechos.
  const coletor = new FocusCollector()
  coletor.push(amostra({ ts: new Date(Date.now() + 120_000).toISOString() }))
  const id = (db.prepare('select id from blocks order by id desc limit 1').get() as any).id

  coletor.push(amostra({
    ts: new Date(Date.now() + 124_000).toISOString(),
    tocando: 'John Coltrane — Naima',
  }))
  const novo = db.prepare('select * from blocks order by id desc limit 1').get() as any
  assert.notEqual(novo.id, id, 'a faixa mudou e o bloco continuou o mesmo')
  assert.equal(novo.tocando, 'John Coltrane — Naima')
})

test('janela sigilosa não guarda título nem endereço', () => {
  const coletor = new FocusCollector()
  coletor.push(amostra({
    app: '1Password', title: 'Cofre pessoal', url: 'https://banco.exemplo/conta',
    ts: new Date(Date.now() + 60_000).toISOString(),
  }))
  const bloco = db.prepare('select * from blocks order by id desc limit 1').get() as any
  assert.equal(bloco.app, '1Password', 'o app em si pode ser registrado')
  assert.equal(bloco.title, null, 'o título de uma janela sigilosa vazou')
  assert.equal(bloco.url, null, 'o endereço de uma janela sigilosa vazou')
})
