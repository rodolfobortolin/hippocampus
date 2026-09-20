import fs from 'node:fs/promises'
import { setMeta, getMeta } from './db.ts'

/**
 * "Este caminho existe?", sem congelar o processo se a resposta depender de uma
 * permissão.
 *
 * `fs.existsSync` numa pasta protegida pelo macOS não devolve erro: ela para, e
 * para o event loop junto. Num agente de fundo, que não tem como mostrar o
 * diálogo de consentimento, ela para para sempre — o servidor já disse "de pé",
 * nenhuma rota responde, e nem o log ganha mais uma linha. Assíncrono devolve o
 * controle ao loop, e aí o `comLimite` abaixo consegue fazer o trabalho dele.
 */
export async function existe(caminho: string): Promise<boolean> {
  try {
    await fs.access(caminho)
    return true
  } catch {
    return false
  }
}

/**
 * O estado de uma fonte é guardado como código, não como frase.
 *
 * A frase mudaria de idioma com a pessoa, e o que já estava no banco ficaria
 * preso na língua de quem instalou o app. O código é estável; quem traduz é a
 * tela. Mensagem de erro inesperada passa direto, porque essa é do sistema.
 */
export type EstadoDaFonte = 'ok' | 'aguardando-permissao' | 'sem-permissao' | 'nunca' | (string & {})

/**
 * Leituras em pastas protegidas pelo macOS podem parar num diálogo de permissão
 * e nunca voltar. Toda coleta passa por aqui: se estourar o tempo, a fonte é
 * marcada como bloqueada e o resto do coletor segue vivo.
 */
export async function comLimite<T>(
  nome: string, ms: number, tarefa: () => Promise<T>,
): Promise<T | null> {
  let terminou = false
  const estouro = new Promise<null>((resolve) =>
    setTimeout(() => { if (!terminou) resolve(null) }, ms))

  try {
    const resultado = await Promise.race([tarefa().then((valor) => { terminou = true; return valor }), estouro])
    if (resultado === null && !terminou) {
      setMeta(`fonte.${nome}`, 'aguardando-permissao')
      console.error(`[${nome}] sem resposta em ${ms / 1000}s — provável diálogo de permissão do macOS`)
      return null
    }
    setMeta(`fonte.${nome}`, 'ok')
    return resultado as T
  } catch (error) {
    const mensagem = (error as NodeJS.ErrnoException).code === 'EPERM'
      ? 'sem-permissao' : (error as Error).message
    setMeta(`fonte.${nome}`, mensagem)
    console.error(`[${nome}] ${mensagem}`)
    return null
  }
}

export function estadoDasFontes(): Record<string, EstadoDaFonte> {
  const fontes = ['skysight', 'navegadores', 'claude', 'codex', 'shell', 'git']
  return Object.fromEntries(fontes.map((nome) => [nome, getMeta(`fonte.${nome}`, 'nunca')]))
}
