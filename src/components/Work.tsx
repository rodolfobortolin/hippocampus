import { Fragment, useEffect, useMemo, useState } from 'react'
import { api, type Item, type PageKind, type Timesheet, type Touch, type WorkItems } from '../lib/api.ts'
import { addDays, clock, dayOf, duration, number, plural, shortDate, today as todayString, weekdayNames } from '../lib/format.ts'
import { useLanguage } from '../lib/language.tsx'
import type { Strings } from '../lib/strings.ts'

/**
 * Where the time went, by piece of work rather than by app.
 *
 * Every panel here is optional. A consultant's data fills the clients; a
 * designer's has no clients and a column of Figma files; someone who never
 * opens a ticket sees documents and pages. What is not in the data is not on
 * the screen, so no one is shown an empty "clients" box for a way of working
 * that is not theirs.
 */

/** "Synapse-Oasis" and "synapseoasis" are one client — the core's rule. */
const orgName = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '')

type Weighed = { seconds: number; agentSeconds: number; visits: number; commits: number; prompts: number }

const SOURCE_TONE: Record<Touch['source'], string> = {
  window: 'var(--research)', visit: 'var(--water)', commit: 'var(--code)',
  prompt: 'var(--ai)', branch: 'var(--gold)', agent: 'var(--ember)',
}

/**
 * What to call a line. A key goes up front only where people say it out loud
 * — SUP-12, acme/harbor#214, a Confluence space. A video id or a document id
 * is an address, not a name.
 */
const SPOKEN_KEY = new Set<PageKind>(['ticket', 'pull-request', 'issue', 'repo', 'board', 'space'])

/**
 * Kinds that are an activity rather than a piece of work — searching, email,
 * an unknown site. They are the browser's story, told in its panel and one
 * chip away, and stay out of the list of pieces.
 */
const ACTIVITY = new Set<PageKind>(['page', 'search', 'mail', 'ai', 'chat', 'docs', 'meeting'])
function titleOf(item: Item, t: Strings) {
  if (item.kind === 'admin') return { key: undefined, label: `${t.work.kinds.admin}${item.key ? ` · ${item.key}` : ''}` }
  if (item.kind === 'wiki') return { key: item.key?.split('/')[0], label: item.label }
  if (item.kind === 'page') return { key: undefined, label: item.site }
  if (SPOKEN_KEY.has(item.kind)) return { key: item.key, label: item.label }
  return { key: undefined, label: item.label ?? t.work.kinds[item.kind] }
}

export function Work() {
  const t = useLanguage().t
  const WINDOWS = [
    { days: 7, name: t.rhythm.days7 },
    { days: 30, name: t.rhythm.days30 },
    { days: 90, name: t.rhythm.days90 },
  ]
  const [span, setSpan] = useState(30)
  const [data, setData] = useState<WorkItems | null>(null)
  const [client, setClient] = useState<string | null>(null)
  const [kind, setKind] = useState<PageKind | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [shown, setShown] = useState(25)
  const [drafting, setDrafting] = useState(false)

  // The timesheet is only for someone who asked for it.
  useEffect(() => { api.settings().then((s) => setDrafting(!!s.timesheet)).catch(() => {}) }, [])

  const to = todayString()
  const from = addDays(to, -(span - 1))

  // The previous answer stays on screen until the next one lands.
  useEffect(() => {
    let alive = true
    api.items(from, to).then((d) => alive && setData(d))
    return () => { alive = false }
  }, [from, to])

  const view = useMemo(() => {
    if (!data) return null
    // One measure per screen, and one that spans the whole range: time when
    // the focus samples cover it, visits when the range reaches back before
    // them. Mixing the two would rank a week of samples against months of history.
    const timed = !!data.timeSince && data.timeSince <= from
    const measure = (value: { seconds: number; visits: number }) => (timed ? value.seconds : value.visits)
    const ofClient = client ? data.items.filter((item) => item.org && orgName(item.org) === client) : data.items
    // How much a piece weighs in the list: its time, the agent's included,
    // or — before there was time — how many moments touched it. A ticket only
    // ever worked on through the agent has no visits and still weighs.
    const weight = (item: Weighed) => (timed ? item.seconds + item.agentSeconds : item.visits + item.commits + item.prompts)
    const listed = (kind ? ofClient.filter((item) => item.kind === kind) : ofClient.filter((item) => !ACTIVITY.has(item.kind)))
      .sort((a, b) => weight(b) - weight(a) || b.lastAt - a.lastAt)
    const kinds = new Map<PageKind, { seconds: number; visits: number; n: number }>()
    for (const item of ofClient) {
      const k = kinds.get(item.kind) ?? { seconds: 0, visits: 0, n: 0 }
      // The browser panel counts the page's own time, not the editor's on its branch.
      k.seconds += item.browserSeconds; k.visits += item.visits; k.n++
      kinds.set(item.kind, k)
    }
    const pieces = ofClient.filter((item) => !ACTIVITY.has(item.kind)).length
    return { timed, measure, weight, ofClient, listed, pieces, kinds: [...kinds].map(([name, k]) => ({ name, ...k })) }
  }, [data, client, kind, from])

  if (!data || !view) return <p className="empty">{t.today.loading}</p>

  const { timed, measure, weight } = view
  const clientName = client ? data.orgs.find((org) => orgName(org.org) === client)?.org ?? client : null
  const orgs = data.orgs.filter((org) => weight(org) > 0).sort((a, b) => weight(b) - weight(a)).slice(0, 8)
  const largestOrg = Math.max(1, ...orgs.map(weight))
  const browserKinds = view.kinds.filter((k) => measure(k) > 0).sort((a, b) => measure(b) - measure(a))
  const largestKind = Math.max(1, ...browserKinds.map(measure))
  // Pieces first, by how many lines they hold; the activities after them.
  const chips = [...view.kinds].sort((a, b) =>
    Number(ACTIVITY.has(a.name)) - Number(ACTIVITY.has(b.name)) || Number(a.name === 'page') - Number(b.name === 'page') || b.n - a.n)
  const largestItem = Math.max(1, ...view.listed.map(weight))

  return (
    <>
      <div className="top">
        <div>
          <h2><b>{t.work.title}</b></h2>
          <p>{t.work.pieces(view.pieces)} {t.rhythm.between} {from} {t.rhythm.and} {to}</p>
          {!timed && data.timeSince && <p>{t.work.timeSince(shortDate(data.timeSince))}</p>}
        </div>
        <div className="nav">
          {WINDOWS.map((option) => (
            <button key={option.days} onClick={() => setSpan(option.days)}
              className={span === option.days ? 'active' : ''}>{option.name}</button>
          ))}
        </div>
      </div>

      {!data.items.length ? (
        <div className="panel" style={{ padding: '40px 20px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-mid)' }}>{t.work.empty}</p>
          <p className="note">{t.work.emptyNote}</p>
        </div>
      ) : (
        <div className="grid" style={{ gap: 14 }}>
          {orgs.length > 0 && (
            <div className="panel">
              <h3>{t.work.byClient} <em>{t.work.byClientNote}</em></h3>
              <div className="clients">
                {orgs.map((org) => {
                  const id = orgName(org.org)
                  const value = weight(org)
                  const figures = timed
                    ? [org.seconds ? duration(org.seconds) : '', org.agentSeconds ? `${duration(org.agentSeconds)} ${t.work.agent}` : '']
                    : [org.visits ? plural(org.visits, t.work.visit) : '', org.commits ? plural(org.commits, t.counts.commit) : '',
                        org.prompts ? plural(org.prompts, t.work.prompt) : '']
                  return (
                    <button key={id} type="button" className="client" aria-pressed={client === id}
                      onClick={() => { setClient(client === id ? null : id); setKind(null); setShown(25) }}>
                      <span className="client-name">{org.org}</span>
                      <span className="client-sites">{org.sites.join(' · ')}</span>
                      <span className="client-value">{figures.filter(Boolean).join(' · ')}</span>
                      <span className="track"><i style={{
                        width: `${(value / largestOrg) * 100}%`, background: 'var(--gold)',
                        boxShadow: '0 0 9px var(--gold)', opacity: 0.8,
                      }} /></span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {clientName && (
            <div className="slot-chip appear">
              <span>{t.rhythm.showingOnly} <b>{clientName}</b></span>
              <button type="button" onClick={() => { setClient(null); setKind(null) }}>{t.work.seeAll}</button>
            </div>
          )}

          <div className="grid g32">
            <div className="panel">
              <h3>{t.work.piecesTitle}</h3>
              <div className="legend kinds" style={{ marginTop: 0, marginBottom: 14 }}>
                <button type="button" className={`pill${kind === null ? ' active' : ''}`} onClick={() => setKind(null)}>
                  {t.work.all} <b>{number(view.pieces)}</b>
                </button>
                {chips.map((chip) => (
                  <button key={chip.name} type="button" className={`pill${kind === chip.name ? ' active' : ''}`}
                    onClick={() => { setKind(kind === chip.name ? null : chip.name); setShown(25) }}>
                    {t.work.kinds[chip.name]} <b>{number(chip.n)}</b>
                  </button>
                ))}
              </div>

              <div className="pieces">
                {view.listed.slice(0, shown).map((item) => (
                  <Piece key={item.id} item={item} t={t} largest={largestItem} main={weight(item)}
                    tone={timed ? 'var(--ember)' : 'var(--water)'}
                    open={open === item.id} from={from} to={to}
                    onToggle={() => setOpen(open === item.id ? null : item.id)} />
                ))}
              </div>
              {view.listed.length > shown && (
                <button type="button" className="more" onClick={() => setShown(shown + 25)}>
                  {t.work.more(Math.min(25, view.listed.length - shown))}
                </button>
              )}
            </div>

            <div className="panel">
              <h3>{t.work.browser}</h3>
              <p className="note" style={{ marginTop: -6, marginBottom: 14 }}>
                {timed ? t.work.browserTime : t.work.browserVisits}
              </p>
              {browserKinds.length ? (
                <div className="rows">
                  {browserKinds.map((k) => (
                    <div key={k.name} className="row">
                      <span className="name">{t.work.kinds[k.name]}</span>
                      <span className="value">{timed ? duration(k.seconds) : number(k.visits)}</span>
                      <span className="track"><i style={{
                        width: `${(measure(k) / largestKind) * 100}%`, background: 'var(--water)',
                        boxShadow: '0 0 9px var(--water)', opacity: 0.85,
                      }} /></span>
                    </div>
                  ))}
                </div>
              ) : <p className="empty">{t.common.nothingHere}</p>}
            </div>
          </div>

          {drafting && <WeekSheet t={t} />}
        </div>
      )}
    </>
  )
}

const hm = (seconds: number) => {
  const minutes = Math.round(seconds / 60)
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`
}

/**
 * The week as a draft timesheet: a row per client and per line under it, a
 * column per day, the total, and the agent's time apart. It is laid out to be
 * checked and copied, not admired — and the time with no client sits at the
 * bottom, in plain sight.
 */
function WeekSheet({ t }: { t: Strings }) {
  const [offset, setOffset] = useState(0)
  const [sheet, setSheet] = useState<Timesheet | null>(null)
  const today = todayString()
  // Weeks start on Monday, the way timesheets are filled in.
  const weekday = new Date(`${today}T12:00:00`).getDay()
  const monday = addDays(today, -((weekday + 6) % 7) + 7 * offset)
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i))
  const names = weekdayNames()

  useEffect(() => {
    let alive = true
    api.timesheet(monday, days[6] > today ? today : days[6]).then((d) => alive && setSheet(d))
    return () => { alive = false }
  }, [monday])

  const empty = sheet && !sheet.clients.length && !sheet.unassigned
  return (
    <div className="panel">
      <h3>
        <span>{t.work.timesheet} <em>{shortDate(days[0])} – {shortDate(days[6])}</em></span>
        <span className="nav">
          <button type="button" onClick={() => setOffset(offset - 1)}>{t.work.previousWeek}</button>
          <button type="button" disabled={offset === 0} onClick={() => setOffset(0)}>{t.work.thisWeek}</button>
          <button type="button" disabled={offset >= 0} onClick={() => setOffset(offset + 1)}>{t.work.nextWeek}</button>
        </span>
      </h3>
      <p className="note" style={{ marginTop: -6, marginBottom: 14 }}>{t.work.timesheetNote}</p>
      {!sheet ? <p className="empty">{t.today.loading}</p> : empty ? <p className="empty">{t.work.noTimesheet}</p> : (
        <div className="sheet-scroll">
          <table className="sheet">
            <thead>
              <tr>
                <th />
                {days.map((day) => <th key={day}>{names[new Date(`${day}T12:00:00`).getDay()]}</th>)}
                <th>{t.work.total}</th>
                <th>{t.work.agentColumn}</th>
              </tr>
            </thead>
            <tbody>
              {sheet.clients.map((client) => (
                <Fragment key={client.org}>
                  <tr className="sheet-client">
                    <td>{client.org}</td>
                    {days.map((day) => <td key={day}>{client.days[day] ? hm(client.days[day]) : ''}</td>)}
                    <td>{hm(client.seconds)}</td>
                    <td className="sheet-agent">{client.agentSeconds ? hm(client.agentSeconds) : ''}</td>
                  </tr>
                  {client.lines.map((line) => (
                    <tr key={line.what}>
                      <td className="sheet-line">
                        {line.kind === 'ticket' ? <b>{line.what}</b> : line.what}
                        {line.label && <span> {line.label}</span>}
                      </td>
                      {days.map((day) => <td key={day}>{line.days[day] ? hm(line.days[day]) : ''}</td>)}
                      <td>{hm(line.seconds)}</td>
                      <td className="sheet-agent">{line.agentSeconds ? hm(line.agentSeconds) : ''}</td>
                    </tr>
                  ))}
                </Fragment>
              ))}
              {sheet.unassigned > 0 && (
                <tr className="sheet-unassigned">
                  <td>{t.work.unassigned}</td>
                  {days.map((day) => <td key={day} />)}
                  <td>{hm(sheet.unassigned)}</td>
                  <td />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/**
 * One line of work. A line with a key opens onto every moment that touched
 * it; a group — email, search, one site's pages — has no moments to show.
 */
function Piece({ item, t, largest, main, tone, open, from, to, onToggle }: {
  item: Item; t: Strings; largest: number; main: number; tone: string
  open: boolean; from: string; to: string; onToggle: () => void
}) {
  const { key, label } = titleOf(item, t)
  const figures = [
    item.seconds ? `${duration(item.seconds)} ${t.work.focused}` : '',
    item.agentSeconds ? `${duration(item.agentSeconds)} ${t.work.agent}` : '',
    item.visits ? plural(item.visits, t.work.visit) : '',
    item.commits ? plural(item.commits, t.counts.commit) : '',
    item.prompts ? plural(item.prompts, t.work.prompt) : '',
  ].filter(Boolean)
  // "ticket" is the core's placeholder for a key whose site was never seen.
  const where = [item.site === 'ticket' ? undefined : item.site, item.org, item.project]
    .filter((part, i, all) => part && all.indexOf(part) === i)
  const openable = !!item.key && item.kind !== 'admin'

  const body = (
    <>
      <span className="piece-what">
        {key && <b>{key}</b>}
        {label && <span>{label}</span>}
      </span>
      <span className="piece-where">{where.join(' · ')}</span>
      <span className="piece-figures">{figures.join(' · ')}</span>
      <span className="track"><i style={{
        width: `${(main / largest) * 100}%`, background: tone, opacity: 0.8,
      }} /></span>
    </>
  )

  return (
    <div className={`piece${open ? ' open' : ''}`}>
      {openable
        ? <button type="button" className="piece-line" aria-expanded={open} onClick={onToggle}>{body}</button>
        : <div className="piece-line">{body}</div>}
      {open && item.key && <Moments itemKey={item.key} from={from} to={to} t={t} />}
    </div>
  )
}

/** Everything that touched one piece of work, in order, a day at a time. */
function Moments({ itemKey, from, to, t }: { itemKey: string; from: string; to: string; t: Strings }) {
  const [touches, setTouches] = useState<Touch[] | null>(null)
  useEffect(() => {
    let alive = true
    api.item(itemKey, from, to).then((d) => alive && setTouches(d.touches))
    return () => { alive = false }
  }, [itemKey, from, to])

  if (!touches) return <p className="note moments-wait">{t.today.loading}</p>
  if (!touches.length) return <p className="note moments-wait">{t.work.noMoments}</p>

  // The most recent sixty: a ticket worked on for weeks has hundreds of
  // moments, and the latest are the ones anyone opening it wants.
  const recent = touches.slice(-60)
  const days: { day: string; touches: Touch[] }[] = []
  for (const touch of recent) {
    const day = dayOf(touch.at)
    if (days[days.length - 1]?.day !== day) days.push({ day, touches: [] })
    days[days.length - 1].touches.push(touch)
  }

  return (
    <div className="moments appear">
      <div className="label">{t.work.moments}</div>
      {days.map(({ day, touches: ofDay }) => (
        <div key={day} className="moments-day">
          <div className="moments-date">{shortDate(day)}</div>
          <div className="moments-list">
            {ofDay.map((touch, i) => (
              <div key={`${touch.at}-${i}`} className="moment">
                <span className="moment-time">{clock(touch.at)}</span>
                <span className="moment-source" style={{ color: SOURCE_TONE[touch.source], borderColor: SOURCE_TONE[touch.source] }}>
                  {t.work.source[touch.source]}
                </span>
                <span className="moment-text">
                  {touch.text ?? ''}{touch.seconds ? <em> · {duration(touch.seconds)}</em> : null}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
