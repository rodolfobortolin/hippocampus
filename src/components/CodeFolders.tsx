import { useEffect, useState } from 'react'
import { api } from '../lib/api.ts'
import { useLanguage } from '../lib/language.tsx'

/**
 * The folders the code lives in: in the walkthrough and in Settings.
 *
 * One folder was not enough — work in ~/Documents/GitHub and side projects in
 * ~/Projects is common, and a repository outside the one folder had no
 * commits, no branches and no owner in the timesheet. Each folder says how
 * many repositories it holds, so a wrong pick shows at once; the usual places
 * that hold repositories and are not read yet are offered underneath, to take
 * with one click rather than to go and find.
 */

type Bridge = { chooseFolder?: (message: string) => Promise<string | null> }
const bridge = (globalThis as any).hippocampus as Bridge | undefined

type Count = { root: string; repos: number; names: string[]; readable: boolean }

/** The home folder as ~, the way people say it. */
const short = (folder: string) => folder.replace(/^\/Users\/[^/]+/, '~')

export function CodeFolders({ onCount }: { onCount?: (repos: number) => void }) {
  const { t, settings, save } = useLanguage()
  const o = t.onboarding
  const [counts, setCounts] = useState<Record<string, Count | null>>({})
  const [offered, setOffered] = useState<{ root: string; repos: number; names: string[] }[]>([])
  const roots = settings?.codeRoots ?? []
  const key = roots.join('\n')

  useEffect(() => {
    let alive = true
    for (const root of roots) {
      api.repos(root).then((count) => alive && setCounts((all) => ({ ...all, [root]: count })))
        .catch(() => alive && setCounts((all) => ({ ...all, [root]: null })))
    }
    api.suggestRoots().then((list) => alive && setOffered(list)).catch(() => {})
    return () => { alive = false }
  }, [key])

  const total = roots.reduce((sum, root) => sum + (counts[root]?.repos ?? 0), 0)
  useEffect(() => { onCount?.(total) }, [total])

  if (!settings) return null

  const keep = (next: string[]) => save({ codeRoots: [...new Set(next)] })
  const add = async () => {
    const chosen = await bridge?.chooseFolder?.(o.pickCode)
    if (chosen) await keep([...roots, chosen])
  }

  const found = (count: Count | null | undefined) => !count ? ''
    : !count.readable ? o.unreadable
      : count.repos ? `${o.reposFound(count.repos)} — ${count.names.join(', ')}${count.repos > count.names.length ? '…' : ''}`
        : o.noRepos

  return (
    <div className="folders">
      <ul className="folders-list">
        {roots.map((root) => (
          <li key={root} className="folder">
            <div>
              <code title={root}>{short(root)}</code>
              <span className={`onb-found ${counts[root]?.repos ? 'ok' : ''}`}>{found(counts[root])}</span>
            </div>
            {roots.length > 1 && (
              <button type="button" className="folder-remove" aria-label={o.removeFolder(short(root))} title={o.removeFolder(short(root))}
                onClick={() => void keep(roots.filter((candidate) => candidate !== root))}>×</button>
            )}
          </li>
        ))}
      </ul>
      {bridge?.chooseFolder && (
        <button type="button" className="onb-button" onClick={() => void add()}>
          {roots.length ? o.addFolder : o.choose}
        </button>
      )}
      {offered.length > 0 && (
        <ul className="folders-offered">
          {offered.map((place) => (
            <li key={place.root}>
              <span>{o.alsoFound(short(place.root), place.repos)} <em>{place.names.slice(0, 4).join(', ')}{place.repos > 4 ? '…' : ''}</em></span>
              <button type="button" className="onb-link" onClick={() => void keep([...roots, place.root])}>{o.include}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
