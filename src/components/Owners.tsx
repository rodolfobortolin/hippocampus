import { useEffect, useId, useState } from 'react'
import { api, type Found, type OwnerAnswer } from '../lib/api.ts'
import { useLanguage } from '../lib/language.tsx'

/**
 * Whose each thing is, as the app found it: in the walkthrough, right after
 * the code folder, and in Settings.
 *
 * Each row says what the app would do and why, in a sentence — "you have
 * commits here, but no ticket says whose it is" — and three choices. The
 * doubtful rows come first and are marked; the settled ones are folded away,
 * since asking someone to confirm what the evidence already settles is how a
 * walkthrough gets skipped. Any click is an answer, and an answer outranks
 * every rule the timesheet has.
 *
 * Under the list, a sentence or two in the person's own words for jev, which
 * reads it when a window has no clear owner.
 */

const same = (a: OwnerAnswer, b: OwnerAnswer) =>
  a.as === b.as && (a.as !== 'client' || (b.as === 'client' && a.client === b.client))

const hours = (seconds: number) => {
  const minutes = Math.round(seconds / 60)
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, '0')}`
}

export function Owners({ scan = false }: { scan?: boolean }) {
  const { t, settings, save } = useLanguage()
  const w = t.owners
  const [found, setFound] = useState<Found[] | null>(null)
  // What was in doubt when the list opened stays at the top while it is open:
  // an answered row that jumped away read as the click having lost it.
  const [asked, setAsked] = useState<Set<string>>(new Set())
  const [unfolded, setUnfolded] = useState(false)
  const [context, setContext] = useState(settings?.context ?? '')
  const [saved, setSaved] = useState(false)
  const names = useId()
  // While the repositories are read, their names pass by one at a time: the
  // wait shows what it is spent on instead of a sentence standing still.
  const [passing, setPassing] = useState<string[]>([])
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (found || !settings) return
    let alive = true
    Promise.all(settings.codeRoots.map((root) => api.repos(root).catch(() => null)))
      .then((counts) => alive && setPassing(counts.flatMap((count) => count?.names ?? [])))
    const timer = setInterval(() => setTick((at) => at + 1), 420)
    return () => { alive = false; clearInterval(timer) }
  }, [found === null])

  useEffect(() => {
    let alive = true
    api.owners(scan).then((list) => {
      if (!alive) return
      setFound(list)
      setAsked(new Set(list.filter((item) => !item.sure && !item.answer).map((item) => item.key)))
    }).catch(() => alive && setFound([]))
    return () => { alive = false }
  }, [scan])

  if (!settings) return null

  const answer = (item: Found, value: OwnerAnswer | null) => {
    setFound((list) => list?.map((candidate) => candidate.key === item.key ? { ...candidate, answer: value } : candidate) ?? null)
    void save({ owners: { [item.key]: value } })
  }

  const clients = [...new Set((found ?? []).flatMap((item) => {
    const chosen = item.answer ?? item.suggestion
    return chosen.as === 'client' ? [chosen.client] : []
  }))].sort()

  const reason = (item: Found) => {
    const { detail } = item
    switch (item.reason) {
      case 'your-account': return w.yourAccount
      case 'known-client': return w.knownClient(detail.client ?? '')
      case 'commits': return w.commits
      case 'cloned': return w.cloned
      case 'tickets': return w.tickets((detail.tickets ?? []).join(', '))
      case 'read-only': return w.readOnly((detail.tickets ?? []).join(', '))
      case 'named-after-client': return w.namedAfterClient(detail.client ?? '')
      case 'no-owner': return detail.seconds ? w.noOwner(hours(detail.seconds)) : ''
    }
  }
  const evidence = (item: Found) => item.detail.repos?.length
    ? w.repos(item.detail.repos.length, item.detail.repos.join(', '))
    : item.detail.windows?.join(' · ') ?? ''

  const open = (found ?? []).filter((item) => asked.has(item.key))
  const settled = (found ?? []).filter((item) => !asked.has(item.key))
  const shown = unfolded ? [...open, ...settled] : open

  const row = (item: Found, index: number) => {
    const chosen = item.answer ?? item.suggestion
    const asking = !item.sure && !item.answer
    const choice = (as: OwnerAnswer['as']) => {
      const next: OwnerAnswer = as === 'client'
        ? { as, client: chosen.as === 'client' ? chosen.client : item.detail.client ?? clients[0] ?? item.name }
        : { as }
      return (
        <button type="button" className={chosen.as === as ? 'active' : ''} aria-pressed={chosen.as === as}
          onClick={() => answer(item, next)}>
          {as === 'client' ? w.client : as === 'personal' ? w.personal : w.none}
        </button>
      )
    }
    return (
      <li key={item.key} className={`owner ${asking ? 'asking' : ''}`} style={{ '--i': index } as React.CSSProperties}>
        <div className="owner-what">
          <b>{item.name}</b>
          {asking && <span className="owner-flag">{w.unsure}</span>}
          <span className="owner-why">{reason(item)}</span>
          {evidence(item) && <span className="owner-evidence" title={evidence(item)}>{evidence(item)}</span>}
        </div>
        <div className="owner-answer">
          <span className="nav owner-choices">{choice('client')}{choice('personal')}{choice('none')}</span>
          {chosen.as === 'client' && (
            <input className="owner-client" list={names} defaultValue={chosen.client} aria-label={w.clientName}
              placeholder={w.clientName} key={`${item.key}:${chosen.client}`}
              onBlur={(event) => {
                const client = event.target.value.trim()
                if (client && client !== chosen.client) answer(item, { as: 'client', client })
              }}
              onKeyDown={(event) => { if (event.key === 'Enter') (event.target as HTMLInputElement).blur() }} />
          )}
          {item.answer && !same(item.answer, item.suggestion) && (
            <button type="button" className="owner-undo" onClick={() => answer(item, null)}>{w.undo}</button>
          )}
        </div>
      </li>
    )
  }

  return (
    <div className="owners">
      <datalist id={names}>{clients.map((client) => <option key={client} value={client} />)}</datalist>
      {!found ? (
        <div className="owners-wait" aria-live="polite">
          <p className="owners-reading">
            <i aria-hidden="true" />
            {passing.length ? <span key={tick % passing.length}>{w.reading(passing[tick % passing.length])}</span> : <span>{w.scanning}</span>}
          </p>
          <ul className="owners-list" aria-hidden="true">
            {[0, 1, 2].map((index) => (
              <li key={index} className="owner skeleton" style={{ '--i': index } as React.CSSProperties}>
                <div className="owner-what"><b /><span /></div>
                <div className="owner-answer"><span /></div>
              </li>
            ))}
          </ul>
        </div>
      )
        : !found.length ? <p className="owners-empty">{w.empty}</p>
          : (
            <>
              {!open.length && !unfolded && <p className="owners-empty">{w.empty}</p>}
              {shown.length > 0 && <ul className="owners-list">{shown.map(row)}</ul>}
              {settled.length > 0 && (
                <button type="button" className="owners-fold" onClick={() => setUnfolded((on) => !on)}>
                  {unfolded ? w.hideSettled : w.showSettled(settled.length)}
                </button>
              )}
            </>
          )}
      <label className="owners-context">
        <b>{w.contextTitle}</b>
        <span>{w.contextNote}</span>
        <textarea rows={3} value={context} placeholder={w.contextPlaceholder}
          onChange={(event) => { setContext(event.target.value); setSaved(false) }}
          onBlur={() => {
            if (context === settings.context) return
            void save({ context }).then(() => setSaved(true))
          }} />
        {saved && <em>{w.contextSaved}</em>}
      </label>
    </div>
  )
}
