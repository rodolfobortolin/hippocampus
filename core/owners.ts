import { dayOf } from './config.ts'
import { all, getMeta, one } from './db.ts'
import { askClient } from './jev.ts'
import { orgName, ticketKnowledge } from './items.ts'
import { readSettings, type OwnerAnswer } from './settings.ts'
import { Clients, timesheet } from './timesheet.ts'

/**
 * Whose each thing is, as the app found it, and what it would say about it.
 *
 * The timesheet guesses from evidence — a remote, a ticket, a commit — and
 * most guesses are safe. This is the list of them laid out for the person to
 * confirm, with the doubtful ones first and a plain reason beside each: in the
 * walkthrough, where the app shows what it found, and in Settings, where an
 * answer can be changed. An answer outranks every rule; with none, the rules
 * decide as before.
 *
 * Four kinds of thing, each keyed the way an answer is stored:
 *
 *   owner:acme       who a repository belongs to, from its remote
 *   site:acme        an Atlassian site, a Linear team, a Notion workspace
 *   repo:sidequest   one repository of the person's own that is named after a
 *                    client — the one case the remote cannot settle
 *   place:host       where time went that nothing could place
 */

export type Kind = 'owner' | 'site' | 'repo' | 'place'

/** Why the suggestion is what it is — the interface says it in words. */
export type Reason = 'your-account' | 'known-client' | 'commits' | 'cloned' | 'tickets' | 'read-only' | 'named-after-client' | 'no-owner'

export type Found = {
  key: string
  kind: Kind
  name: string
  suggestion: OwnerAnswer
  /** Whether the evidence settles it. The doubtful ones are what the person is asked. */
  sure: boolean
  reason: Reason
  /** What backs the suggestion, to show beside it. */
  detail: { repos?: string[]; host?: string; tickets?: string[]; seconds?: number; windows?: string[]; client?: string }
  answer: OwnerAnswer | null
}

const list = (key: string): string[] => {
  try {
    const value = JSON.parse(getMeta(key, '[]'))
    return Array.isArray(value) ? value.map(String) : []
  } catch {
    return []
  }
}

/** Where everything happens — browsers with no site, the Finder — so no one answer could be true of it. */
const EVERYWHERE = new Set(['Google Chrome', 'Safari', 'Arc', 'Firefox', 'Microsoft Edge', 'Brave Browser', 'Opera',
  'Vivaldi', 'Chromium', 'Orion', 'Zen', 'Dia', 'Comet', 'Finder', 'System Settings', 'System Preferences',
  'Ajustes do Sistema', 'Preferências do Sistema', 'Activity Monitor', 'Monitor de Atividade'])

/** A place worth asking about: at least this much time in the last two weeks. */
const PLACE_MINIMUM = 15 * 60

export function foundOwners(now = Date.now() / 1000): Found[] {
  const answers = readSettings().owners
  const you = new Set(list('you').map(orgName).filter((key) => key.length >= 3))
  const found: Found[] = []
  const push = (item: Omit<Found, 'answer'>) => found.push({ ...item, answer: answers[item.key] ?? null })

  // The sites tickets live on: the surest clients there are.
  const known = new Clients()
  const sites = new Map<string, { org: string; prefixes: string[] }>()
  for (const [prefix, home] of ticketKnowledge().homes) {
    if (!home.org) continue
    const site = sites.get(orgName(home.org)) ?? { org: home.org, prefixes: [] }
    site.prefixes.push(prefix)
    sites.set(orgName(home.org), site)
    known.know(home.org)
  }
  // A site is surely a client when its tickets are in the person's own work
  // — a commit, a question to an agent. Only read there, it may be a vendor's
  // or a community's Jira, and it is asked.
  const worked = (prefix: string) => Boolean(one(
    `select 1 from commits where subject like ? union all select 1 from ai_turns where prompt like ? limit 1`,
    `%${prefix}-%`, `%${prefix}-%`))
  for (const site of sites.values()) {
    const sure = site.prefixes.some(worked)
    push({
      key: `site:${orgName(site.org)}`, kind: 'site', name: site.org,
      suggestion: { as: 'client', client: site.org }, sure, reason: sure ? 'tickets' : 'read-only',
      detail: { tickets: site.prefixes.sort().slice(0, 8) },
    })
  }

  // The owners of the repositories on this Mac.
  const owners = new Map<string, { owner: string; host: string | null; repos: string[]; worked: number }>()
  for (const repo of all<{ name: string; main: string; owner: string | null; host: string | null; worked: number }>(
    `select name, main, owner, host, worked from repos where owner is not null order by name`)) {
    const entry = owners.get(orgName(repo.owner!)) ?? { owner: repo.owner!, host: repo.host, repos: [], worked: 0 }
    // A worktree is its repository, listed once.
    if (repo.name === repo.main || !entry.repos.includes(repo.main)) entry.repos.push(repo.main)
    entry.worked += repo.worked
    owners.set(orgName(repo.owner!), entry)
  }
  for (const entry of owners.values()) {
    const base = { key: `owner:${orgName(entry.owner)}`, kind: 'owner' as const, name: entry.owner }
    const detail = { repos: [...new Set(entry.repos)].slice(0, 8), host: entry.host ?? undefined }
    if (you.has(orgName(entry.owner))) {
      push({ ...base, suggestion: { as: 'personal' }, sure: true, reason: 'your-account', detail })
    } else if (!entry.worked) {
      push({ ...base, suggestion: { as: 'none' }, sure: true, reason: 'cloned', detail })
    } else {
      const match = known.find(entry.owner)
      push({
        ...base, suggestion: { as: 'client', client: match ?? entry.owner }, sure: Boolean(match),
        reason: match ? 'known-client' : 'commits', detail: { ...detail, client: match },
      })
      known.know(match ?? entry.owner)
    }
  }

  // A repository of the person's own named after a client: the remote says
  // personal, the name says otherwise. Asked, never assumed.
  const clientKeys = [...found].filter((item) => item.suggestion.as === 'client')
    .map((item) => (item.suggestion as { client: string }).client)
  for (const entry of owners.values()) {
    if (!you.has(orgName(entry.owner))) continue
    for (const repo of new Set(entry.repos)) {
      const client = clientKeys.find((name) => orgName(name).length >= 4 && orgName(repo).includes(orgName(name)))
      if (!client) continue
      push({
        key: `repo:${repo}`, kind: 'repo', name: repo, suggestion: { as: 'personal' }, sure: false,
        reason: 'named-after-client', detail: { client, host: entry.host ?? undefined },
      })
    }
  }

  // Where time went that nothing placed, over the last two weeks, leaving out
  // what jev already called a distraction: those are the questions left.
  const to = dayOf(now)
  const from = dayOf(now - 13 * 86_400)
  for (const leftover of timesheet(from, to, now).leftovers) {
    if (leftover.seconds < PLACE_MINIMUM || leftover.category === 'distraction') continue
    // A browser with no site, the Finder, an assistant: where everything
    // happens, so no one answer could be true of it.
    if (EVERYWHERE.has(leftover.place) || leftover.category === 'ai') continue
    push({
      key: `place:${leftover.place}`, kind: 'place', name: leftover.place,
      suggestion: { as: 'none' }, sure: false, reason: 'no-owner',
      detail: { seconds: leftover.seconds, windows: leftover.windows.map((window) => window.title ?? window.app).filter(Boolean).slice(0, 3) },
    })
  }

  // What was answered but no longer found is still listed, so it can be undone.
  for (const [key, answer] of Object.entries(answers)) {
    if (found.some((item) => item.key === key)) continue
    const [kind, ...rest] = key.split(':')
    if (!['owner', 'site', 'repo', 'place'].includes(kind)) continue
    found.push({ key, kind: kind as Kind, name: rest.join(':'), suggestion: answer, sure: true, reason: 'no-owner', detail: {}, answer })
  }

  const order: Record<Kind, number> = { site: 0, owner: 1, repo: 2, place: 3 }
  return found.sort((a, b) =>
    Number(a.sure || a.answer !== null) - Number(b.sure || b.answer !== null) || order[a.kind] - order[b.kind] || a.name.localeCompare(b.name))
}

/** The clients jev may name, and what the person wrote about their work. */
export function jevContext(): { clients: string[]; note: string } {
  const clients = new Set<string>()
  for (const item of foundOwners()) {
    const answer = item.answer ?? item.suggestion
    if (answer.as === 'client') clients.add(answer.client)
  }
  return { clients: [...clients].slice(0, 20), note: readSettings().context }
}

/**
 * Asks jev about the windows of the last week left with no client, the
 * longest first and a few at a time, each once — again only after the person
 * changes what they wrote about their work.
 */
export async function askAboutLeftovers(now = Date.now() / 1000, limit = 12): Promise<number> {
  const { clients, note } = jevContext()
  if (!clients.length) return 0
  const changed = Number(getMeta('context.changed', '0'))
  const windows = timesheet(dayOf(now - 6 * 86_400), dayOf(now), now).leftovers
    .filter((leftover) => leftover.category !== 'distraction')
    .flatMap((leftover) => leftover.windows.filter((window) => window.seconds >= 5 * 60)
      .map((window) => ({ ...window, host: leftover.place.includes('.') ? leftover.place : null })))
    .sort((a, b) => b.seconds - a.seconds)
  let asked = 0
  for (const window of windows) {
    if (asked >= limit) break
    const row = one<{ client_at: number | null }>('select client_at from labels where key = ?', window.key)
    if (!row || (row.client_at && row.client_at >= changed)) continue
    if ((await askClient(window, clients, note)) === null) break
    asked++
  }
  return asked
}
