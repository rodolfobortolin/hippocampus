import { useLanguage } from '../lib/language.tsx'

export type Pending = { id: string; tool: string; detail: string }

/**
 * A tool a spoken request wants to run, waiting for a yes.
 *
 * The command or the file is shown as it is, not paraphrased: the point is
 * to see exactly what would happen before it does.
 */
export function ConfirmCard({ pending, answer }: { pending: Pending; answer: (allow: boolean) => void }) {
  const { t } = useLanguage()
  return (
    <div className="confirm appear" role="alertdialog" aria-label={t.chat.confirmTitle}>
      <p className="confirm-title">{t.chat.confirmTitle}</p>
      <p className="confirm-tool">{pending.tool}</p>
      <code className="confirm-detail">{pending.detail}</code>
      <div className="confirm-actions">
        <button className="confirm-deny" onClick={() => answer(false)}>{t.chat.confirmDeny}</button>
        <button className="confirm-allow" onClick={() => answer(true)}>{t.chat.confirmAllow}</button>
      </div>
    </div>
  )
}
