import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LANGUAGES, HOW_TO_WRITE, CATEGORIES_BY_LANGUAGE, CATEGORY_NAMES, LEVELS_BY_LANGUAGE, JEV_QUESTIONS, type Language } from '../core/languages.ts'
import { PERSONAS } from '../core/personas.ts'
import { DOSSIER } from '../core/dossier.ts'

const idiomas = Object.keys(LANGUAGES) as Language[]

// O compilador já exige que todo idioma tenha todas as chaves. O que ele não
// vê é o conteúdo: uma chave presente com o texto de outro idioma colado, ou
// uma categoria que existe num dicionário e não no outro, passam pelo tipo.
test('os cinco idiomas têm as mesmas categorias, com as mesmas chaves', () => {
  const referencia = Object.keys(CATEGORIES_BY_LANGUAGE['pt-BR']).sort()
  for (const idioma of idiomas) {
    assert.deepEqual(Object.keys(CATEGORIES_BY_LANGUAGE[idioma]).sort(), referencia,
      `as categorias de ${idioma} divergem das de pt-BR`)
    for (const chave of referencia) {
      assert.ok(CATEGORY_NAMES[idioma][chave],
        `a categoria ${chave} não tem nome de tela em ${idioma}`)
    }
  }
})

test('a categoria sem rótulo tem nome em todo idioma', () => {
  // A chave é gravada no banco quando o jev não tem confiança. Sem nome de
  // tela, ela aparece crua, em português, no meio de uma interface alemã.
  for (const idioma of idiomas) {
    assert.ok(CATEGORY_NAMES[idioma]['unlabelled'], `falta em ${idioma}`)
  }
})

test('cada idioma traz três níveis de complexidade para o jev', () => {
  for (const idioma of idiomas) {
    assert.equal(LEVELS_BY_LANGUAGE[idioma].length, 3,
      `${idioma} não tem os três níveis que o roteamento de modelo espera`)
  }
})

test('nenhum texto do núcleo ficou vazio ou com sobra de modelo', () => {
  for (const idioma of idiomas) {
    const quem = PERSONAS[idioma]
    const textos = [
      HOW_TO_WRITE[idioma], quem.tom,
      quem.conversa('Fulano', '2026-09-20', 'domingo', '14:00', 4),
      quem.diario('Fulano'), quem.resumo('2026-09-20'), quem.recap('2026-09-20'),
      ...Object.values(JEV_QUESTIONS[idioma]),
    ]
    for (const texto of textos) {
      assert.ok(texto.trim().length > 10, `texto curto demais em ${idioma}`)
      assert.ok(!texto.includes('TODO'), `sobrou um TODO em ${idioma}`)
    }
    // %DADOS% é o lugar onde o material do dia entra. Sem ele, o modelo recebe
    // a instrução e nenhum dado — e responde inventando.
    assert.ok(quem.resumo('x').includes('%DADOS%'), `o resumo de ${idioma} perdeu o %DADOS%`)
    assert.ok(quem.recap('x').includes('%DADOS%'), `o recap de ${idioma} perdeu o %DADOS%`)
  }
})

test('o dossiê fala do trabalho delegado em todo idioma', () => {
  // A distinção entre ociosidade e trabalho delegado é a decisão de produto
  // mais fácil de perder numa tradução, e a que mais custa perder.
  for (const idioma of idiomas) {
    const frase = DOSSIER[idioma].delegado('1h20', '0h30')
    assert.ok(frase.includes('1h20') && frase.includes('0h30'),
      `o dossiê de ${idioma} não usa os dois números que recebe`)
    assert.ok(frase.length > 80, `o dossiê de ${idioma} encurtou a explicação do delegado`)
  }
})
