import { execFile, execFileSync } from 'node:child_process'
import fs from 'node:fs'
import { config } from './config.ts'
import { getMeta, setMeta } from './db.ts'
import { idiomaValido, type Idioma } from './idiomas.ts'

/**
 * Os ajustes do app, editáveis dentro dele.
 *
 * O que não é segredo vive na tabela `meta` do próprio banco. O que é segredo
 * — as duas chaves — vive no Chaveiro do macOS, nunca em arquivo de texto e
 * nunca num commit. O `.env` continua funcionando para quem desenvolve, mas
 * perde para o Chaveiro: o que a pessoa digita no app é o que vale.
 */
export type Ajustes = {
  idioma: Idioma
  nome: string
  vault: string
  pastaDiario: string
  inicioDoDia: number
  guardarDigitacao: boolean
  voz: string
}

export type EstadoChave = 'chaveiro' | 'ambiente' | 'vazia'

const SERVICO = 'Hipocampo'
const CONTAS = { jev: 'typesafe-api-key', openai: 'openai-api-key' } as const
export type NomeChave = keyof typeof CONTAS

/** Lê um segredo do Chaveiro. Ausente devolve string vazia, não erro. */
export function leChave(nome: NomeChave): string {
  try {
    return execFileSync('security', ['find-generic-password', '-a', CONTAS[nome], '-s', SERVICO, '-w'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return ''
  }
}

/**
 * Grava um segredo no Chaveiro. O valor vai pela entrada padrão, não pelos
 * argumentos — argumento de processo é visível para qualquer `ps` da máquina.
 */
export function gravaChave(nome: NomeChave, valor: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const conta = CONTAS[nome]
    if (!valor) {
      execFile('security', ['delete-generic-password', '-a', conta, '-s', SERVICO], () => resolve())
      return
    }
    const processo = execFile('security',
      ['add-generic-password', '-a', conta, '-s', SERVICO, '-U', '-D', 'chave de API', '-w'],
      (erro) => (erro ? reject(erro) : resolve()))
    // O `security` pede a senha duas vezes quando `-w` vem sem valor.
    processo.stdin?.end(`${valor}\n${valor}\n`)
  })
}

export function estadoChave(nome: NomeChave): EstadoChave {
  if (leChave(nome)) return 'chaveiro'
  const doAmbiente = nome === 'jev' ? process.env.TYPESAFE_API_KEY : process.env.OPENAI_API_KEY
  return (doAmbiente ?? '').trim() ? 'ambiente' : 'vazia'
}

const PADROES: Ajustes = {
  idioma: idiomaValido(config.lang),
  nome: config.userName,
  vault: config.vault,
  pastaDiario: '10 Diário',
  inicioDoDia: config.dayStartHour,
  guardarDigitacao: config.keepTyping,
  voz: 'onyx',
}

export function leAjustes(): Ajustes {
  const salvo = getMeta('ajustes')
  if (!salvo) return { ...PADROES }
  try {
    const dados = JSON.parse(salvo) as Partial<Ajustes>
    return {
      idioma: idiomaValido(String(dados.idioma ?? PADROES.idioma)),
      nome: String(dados.nome ?? PADROES.nome).trim() || PADROES.nome,
      vault: String(dados.vault ?? PADROES.vault),
      pastaDiario: String(dados.pastaDiario ?? PADROES.pastaDiario),
      inicioDoDia: Math.min(12, Math.max(0, Number(dados.inicioDoDia ?? PADROES.inicioDoDia) || 0)),
      guardarDigitacao: dados.guardarDigitacao !== false,
      voz: String(dados.voz ?? PADROES.voz),
    }
  } catch {
    return { ...PADROES }
  }
}

/**
 * Derrama os ajustes sobre a config viva. Todo mundo lê `config.x` na hora de
 * usar, então mudar aqui muda o app inteiro sem reiniciar — menos a interface,
 * que recarrega os textos por conta própria.
 */
export function aplicaAjustes(ajustes: Ajustes = leAjustes()): Ajustes {
  config.lang = ajustes.idioma
  config.userName = ajustes.nome
  config.vault = ajustes.vault
  config.pastaDiario = ajustes.pastaDiario
  config.dayStartHour = ajustes.inicioDoDia
  config.keepTyping = ajustes.guardarDigitacao
  config.voz = ajustes.voz
  config.typesafeKey = leChave('jev') || (process.env.TYPESAFE_API_KEY ?? '').trim()
  config.openaiKey = leChave('openai') || (process.env.OPENAI_API_KEY ?? '').trim()
  return ajustes
}

export function salvaAjustes(entrada: Partial<Ajustes>): Ajustes {
  const proximo: Ajustes = { ...leAjustes(), ...entrada }
  // Guardar uma pasta que não existe só produziria um diário que some.
  if (proximo.vault && !fs.existsSync(proximo.vault)) proximo.vault = leAjustes().vault
  setMeta('ajustes', JSON.stringify(proximo))
  return aplicaAjustes(proximo)
}
