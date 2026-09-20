import { setMeta, getMeta } from './db.ts'

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
      setMeta(`fonte.${nome}`, 'aguardando permissão')
      console.error(`[${nome}] sem resposta em ${ms / 1000}s — provável diálogo de permissão do macOS`)
      return null
    }
    setMeta(`fonte.${nome}`, 'ok')
    return resultado as T
  } catch (error) {
    const mensagem = (error as NodeJS.ErrnoException).code === 'EPERM'
      ? 'sem permissão' : (error as Error).message
    setMeta(`fonte.${nome}`, mensagem)
    console.error(`[${nome}] ${mensagem}`)
    return null
  }
}

export function estadoDasFontes(): Record<string, string> {
  const fontes = ['skysight', 'navegadores', 'claude', 'codex', 'shell', 'git']
  return Object.fromEntries(fontes.map((nome) => [nome, getMeta(`fonte.${nome}`, 'ainda não tentou')]))
}
