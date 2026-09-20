import { config } from './config.ts'

/**
 * Not everything that crosses the screen deserves to be kept. A password
 * manager, a bank and anything medical do not get in even as a title; a
 * personal conversation gets in as a title, but without what was typed. The
 * rest is recorded normally.
 */

// Only the app name survives: no title, no URL, no typing.
const SECRET = [
  /1password/i, /bitwarden/i, /lastpass/i, /dashlane/i, /keeper/i,
  /acesso às chaves|keychain access/i, /proton pass/i, /enpass/i,
  /\bbanco\b|\bbank\b|itau|itaú|bradesco|santander|nubank|caixa|inter\b|c6bank/i,
  /\bboleto\b|internet ?banking|\bopenbank/i,
  /gov\.br|receita federal|meu inss/i,
  /health|saúde|prontuário|laudo médico/i,
]

// The title stays (it is legitimate context), but what was typed does not.
const NO_TYPING = [
  /whatsapp/i, /\bmessages\b|mensagens/i, /signal/i, /telegram/i,
  /discord/i, /\bmail\b|e-?mail/i, /outlook/i,
]

const matches = (rules: RegExp[], ...fields: (string | null | undefined)[]) =>
  fields.some((field) => field && rules.some((rule) => rule.test(field)))

/** True when not even the window title should be kept. */
export function isSecret(app?: string | null, title?: string | null, host?: string | null): boolean {
  return matches(SECRET, app, title, host)
}

/** True when the text typed there should be kept. */
export function keepsTyping(app?: string | null, title?: string | null): boolean {
  if (!config.keepTyping) return false
  if (isSecret(app, title)) return false
  return !matches(NO_TYPING, app, title)
}
