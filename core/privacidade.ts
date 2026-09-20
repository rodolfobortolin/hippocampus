import { config } from './config.ts'

/**
 * Nem tudo que passa na tela merece ser guardado. Gerenciador de senha, banco
 * e saúde não entram nem como título; conversa pessoal entra como título, mas
 * sem o que foi digitado. O resto é registrado normalmente.
 */

// Só o nome do app sobrevive: sem título, sem URL, sem digitação.
const SIGILOSOS = [
  /1password/i, /bitwarden/i, /lastpass/i, /dashlane/i, /keeper/i,
  /acesso às chaves|keychain access/i, /proton pass/i, /enpass/i,
  /\bbanco\b|\bbank\b|itau|itaú|bradesco|santander|nubank|caixa|inter\b|c6bank/i,
  /\bboleto\b|internet ?banking|\bopenbank/i,
  /gov\.br|receita federal|meu inss/i,
  /health|saúde|prontuário|laudo médico/i,
]

// O título fica (é contexto legítimo), mas o que foi digitado não.
const SEM_DIGITACAO = [
  /whatsapp/i, /\bmessages\b|mensagens/i, /signal/i, /telegram/i,
  /discord/i, /\bmail\b|e-?mail/i, /outlook/i,
]

const bate = (regras: RegExp[], ...campos: (string | null | undefined)[]) =>
  campos.some((campo) => campo && regras.some((regra) => regra.test(campo)))

/** Verdadeiro quando nem o título da janela deve ser guardado. */
export function ehSigiloso(app?: string | null, titulo?: string | null, host?: string | null): boolean {
  return bate(SIGILOSOS, app, titulo, host)
}

/** Verdadeiro quando o texto digitado ali não deve ser guardado. */
export function guardaDigitacao(app?: string | null, titulo?: string | null): boolean {
  if (!config.keepTyping) return false
  if (ehSigiloso(app, titulo)) return false
  return !bate(SEM_DIGITACAO, app, titulo)
}
