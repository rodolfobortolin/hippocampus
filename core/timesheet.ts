import { dayOf } from './config.ts'
import { all, getMeta } from './db.ts'
import { readSettings, type OwnerAnswer } from './settings.ts'
import { labelKey } from './jev.ts'
import { branchLookup, ticketKnowledge, orgName, workItems, NOISE } from './items.ts'
import { readPage, ticketKeys, branchKeys, type Page } from './pages.ts'

/**
 * A draft of a timesheet: the week's hours by client and by piece of work,
 * for someone who bills by the hour to check and correct.
 *
 * It is a record, not a verdict. Nothing here says how much should have been
 * billed; it says where the measured time went, and says just as plainly how
 * much of it has no client — the draft is never made to look more complete
 * than it is.
 *
 * Every second of focus lands on one line at most, in this order:
 *
 *   1. A page that names its owner — a Jira ticket, a Confluence space. On
 *      GitHub the owner counts only when there is work there: a repository on
 *      this Mac pointing at it. Reading someone's public repository is
 *      reading, not working for them.
 *   2. A ticket named by the window title or by the branch the code was on.
 *   3. The project the window was labelled with. Its owner is the remote of
 *      its repository — a worktree answering for the repository it belongs
 *      to — and, without a remote, the owner most of its tickets belong to.
 *      An AI app's window, titled only with the app's name, is in the
 *      project of the question typed while it was in front.
 *   4. A client already known, named in the title or in an email address in
 *      it: a Teams chat on acme's tenant, an inbox at acme.com.
 *
 * Then the meetings: a meeting with guests, for the part of it the Mac saw no
 * focus — the stand-up listened to without touching the keyboard. Its client
 * is named by its title or by its guests' domains.
 *
 * Work on repositories under the person's own account is theirs, not a
 * client's: it is shown apart, as personal, rather than hidden or billed.
 *
 * The agent's minutes are counted apart: time delegated is not time at the
 * keyboard, and whether it is billable is the person's call. The ones with no
 * owner are said too, never dropped.
 */

export type TimesheetLine = {
  /** A ticket key, an area such as "confluence · KB", a project, an app or a meeting. */
  what: string
  kind: 'ticket' | 'area' | 'project' | 'meeting'
  label?: string
  seconds: number
  agentSeconds: number
  days: Record<string, number>
}

export type TimesheetClient = {
  org: string
  seconds: number
  agentSeconds: number
  days: Record<string, number>
  lines: TimesheetLine[]
}

export type Timesheet = {
  from: string
  to: string
  /** The days with focus measured — the columns. The agent's time has none of its own. */
  days: string[]
  clients: TimesheetClient[]
  /** Work on the person's own repositories: theirs, not a client's. */
  personal: TimesheetClient | null
  /** Focus with no client to put it on. */
  unassigned: number
  /** Agent minutes with no client to put them on. */
  unassignedAgent: number
  /**
   * Where the time with no client went, largest first: the place (the site,
   * or the app), and the windows in it. What the person is asked about, and
   * what jev is asked about.
   */
  leftovers: Leftover[]
}

export type Leftover = { place: string; seconds: number; category: string | null; windows: { key: string; app: string; title: string | null; seconds: number }[] }

/** The key a place is answered under: the site when there is one, the app otherwise. */
export const placeOf = (block: { app: string | null; host: string | null }) =>
  (block.host ?? '').replace(/^www\./, '') || block.app || '?'

type Owner = { org: string; personal: boolean }

/** Where a page's time goes when its owner is known, and under which line. */
function areaOf(page: Page): { what: string; kind: TimesheetLine['kind']; label?: string } {
  if (page.kind === 'ticket' && page.key) return { what: page.key, kind: 'ticket', label: page.label }
  if (page.kind === 'admin') return { what: `${page.site} admin${page.key ? ` · ${page.key}` : ''}`, kind: 'area' }
  if ((page.kind === 'wiki' || page.kind === 'space') && page.key) return { what: `${page.site} · ${page.key.split('/')[0]}`, kind: 'area' }
  if ((page.kind === 'repo' || page.kind === 'pull-request' || page.kind === 'issue') && page.key) {
    return { what: `${page.site} · ${page.key.split('#')[0]}`, kind: 'area' }
  }
  if (page.kind === 'board' && page.key) return { what: `${page.site} · ${page.key}`, kind: 'area' }
  return { what: page.site, kind: 'area' }
}

/**
 * Which client each project works for by its tickets: the owner most of them
 * belong to, over the three months before the week. What decides when a
 * project's repository has no remote to say.
 */
function projectClients(to: string): Map<string, string> {
  const from = dayOf(new Date(`${to}T12:00:00`).getTime() / 1000 - 90 * 86_400)
  const votes = new Map<string, Map<string, { org: string; n: number }>>()
  for (const item of workItems(from, to).items) {
    if (item.kind !== 'ticket' || !item.project || !item.org) continue
    const forProject = votes.get(item.project) ?? new Map()
    const vote = forProject.get(orgName(item.org)) ?? { org: item.org, n: 0 }
    vote.n += 1 + item.commits + item.prompts
    forProject.set(orgName(item.org), vote)
    votes.set(item.project, forProject)
  }
  const clients = new Map<string, string>()
  for (const [project, forProject] of votes) {
    clients.set(project, [...forProject.values()].sort((a, b) => b.n - a.n)[0].org)
  }
  return clients
}

const list = (key: string): string[] => {
  try {
    const value = JSON.parse(getMeta(key, '[]'))
    return Array.isArray(value) ? value.map(String) : []
  } catch {
    return []
  }
}

/**
 * The names a client goes by, and the one it is shown with. One organisation
 * is often spelled several ways — "acme" on Jira, "acme-consultants" on
 * Bitbucket — and splitting its hours in two would hide half of them, so a
 * name that begins with a known one is that one.
 */
export class Clients {
  private names = new Map<string, string>()

  know(org: string) {
    const key = orgName(org)
    if (key.length >= 3 && !this.names.has(key)) this.names.set(key, org)
  }

  /** The known client a name belongs to, if any. */
  find(name: string): string | undefined {
    const key = orgName(name)
    if (key.length < 3) return undefined
    const exact = this.names.get(key)
    if (exact) return exact
    let best: string | undefined
    for (const [known, org] of this.names) {
      if (known.length >= 4 && key.startsWith(known) && (!best || known.length > orgName(best).length)) best = org
    }
    return best
  }

  /** The client named in a title: a segment or a parenthesis that is exactly its name, or an address at its domain. */
  inText(text: string | null | undefined): string | undefined {
    if (!text) return undefined
    // A segment of the title, or what sits in parentheses in one — a browser
    // profile is "Ana (Acme)".
    const segments = text.split(/\s+[|•·—–-]\s+/)
    for (const segment of [...segments, ...[...text.matchAll(/\(([^()]{3,40})\)/g)].map((match) => match[1])]) {
      const key = orgName(segment)
      if (key.length >= 3 && this.names.has(key)) return this.names.get(key)
    }
    for (const match of text.matchAll(/[\w.+-]+@([a-z0-9.-]+\.[a-z]{2,})/gi)) {
      const found = this.inDomain(match[1])
      if (found) return found
    }
    return undefined
  }

  /** The client a domain is: "mail.acme.co.uk" is acme. Free mail is nobody's. */
  inDomain(domain: string): string | undefined {
    const labels = domain.toLowerCase().split('.').filter(Boolean)
    if (labels.length < 2) return undefined
    let name = labels[labels.length - 2]
    if (labels.length > 2 && SECOND_LEVEL.has(name)) name = labels[labels.length - 3]
    if (FREE_MAIL.has(name)) return undefined
    const key = orgName(name)
    return key.length >= 3 ? this.names.get(key) : undefined
  }
}

/** What jev answers for a window that is the person's own. */
export const PERSONAL = 'personal'

const SECOND_LEVEL = new Set(['co', 'com', 'org', 'net', 'gov', 'ac', 'edu', 'ne', 'or'])
const FREE_MAIL = new Set(['gmail', 'googlemail', 'outlook', 'hotmail', 'live', 'msn', 'icloud', 'me', 'mac',
  'yahoo', 'proton', 'protonmail', 'aol', 'gmx', 'zoho', 'yandex', 'uol', 'bol', 'terra', 'fastmail', 'hey'])

/**
 * A cancelled meeting some calendars keep, with the word in front of its
 * title: "Canceled: Sprint review". The separator is required, so a meeting
 * about cancelled orders is still a meeting.
 */
const CANCELLED = /^\s*(cancel+ed|cancelad[oa]s?|annul[ée]e?s?|abgesagt|storniert)\s*[:：-]/i

/** Seconds of [start, end) not already in `covered`, which it then joins. Kept sorted and apart. */
function uncovered(covered: [number, number][], start: number, end: number): number {
  let free = 0
  let at = start
  for (const [a, b] of covered) {
    if (b <= at) continue
    if (a >= end) break
    if (a > at) free += a - at
    at = Math.max(at, b)
    if (at >= end) break
  }
  if (at < end) free += end - at
  covered.push([start, end])
  covered.sort((x, y) => x[0] - y[0])
  // Merge, so the next question walks few intervals.
  const merged: [number, number][] = []
  for (const span of covered) {
    const last = merged[merged.length - 1]
    if (last && span[0] <= last[1]) last[1] = Math.max(last[1], span[1])
    else merged.push([span[0], span[1]])
  }
  covered.splice(0, covered.length, ...merged)
  return free
}

export function timesheet(from: string, to: string, now = Date.now() / 1000, answers: Record<string, OwnerAnswer> = readSettings().owners): Timesheet {
  const { prefixes, homes } = ticketKnowledge()
  const branchAt = branchLookup()
  const byProject = projectClients(to)
  const labels = new Map(all<{ key: string; project: string }>(
    `select key, project from labels where project is not null and project <> ''`).map((row) => [row.key, row.project]))
  const aiWindows = new Set(all<{ key: string }>(`select key from labels where category = 'ai'`).map((row) => row.key))
  const categoryOf = new Map(all<{ key: string; category: string | null }>(`select key, category from labels`).map((row) => [row.key, row.category]))
  // The client jev named for a window no rule could place.
  const jevClient = new Map(all<{ key: string; client: string }>(
    `select key, client from labels where client is not null and client <> ''`).map((row) => [row.key, row.client]))
  // The questions put to a coding agent, with the project each was asked in.
  // An AI app's window is titled only with the app's name; the question typed
  // while it was in front says which project it was about.
  const turns = all<{ ts: number; project: string }>(
    `select ts, project from ai_turns where day between ? and ? and project is not null and project <> '' order by ts`,
    dayOf(new Date(`${from}T12:00:00`).getTime() / 1000 - 86_400), dayOf(new Date(`${to}T12:00:00`).getTime() / 1000 + 86_400))
  const askedDuring = (start: number, end: number): string | undefined => {
    let low = 0
    let high = turns.length
    while (low < high) { const mid = (low + high) >> 1; if (turns[mid].ts < start - 120) low = mid + 1; else high = mid }
    return low < turns.length && turns[low].ts <= end + 120 ? turns[low].project : undefined
  }
  const onBranch = (repo: string | null | undefined, at: number) =>
    branchKeys(branchAt(repo, at)).filter((key) => prefixes.has(key.split('-')[0]))

  // Who the person is, as git and GitHub know them.
  const you = new Set(list('you').map(orgName).filter((key) => key.length >= 3))
  const yourDomains = new Set(list('you.domains'))

  // The clients known before this week is read: the owners of the tickets,
  // and of the repositories on this Mac that are not the person's own.
  const known = new Clients()
  for (const home of homes.values()) if (home.org) known.know(home.org)
  for (const org of byProject.values()) known.know(org)
  const repos = all<{ name: string; main: string; owner: string | null; worked: number }>(
    `select name, main, owner, worked from repos`)
  // What the person said outranks every rule. "Not work" is no owner at all.
  const said = (key: string, name: string): Owner | null | undefined => {
    const answer = answers[key]
    if (!answer) return undefined
    if (answer.as === 'none') return null
    return answer.as === 'personal' ? { org: name, personal: true } : { org: answer.client, personal: false }
  }
  for (const answer of Object.values(answers)) if (answer.as === 'client') known.know(answer.client)
  const ownerOf = (owner: string): Owner | null => {
    const answer = said(`owner:${orgName(owner)}`, owner)
    if (answer !== undefined) return answer
    return you.has(orgName(owner)) ? { org: owner, personal: true } : { org: known.find(owner) ?? owner, personal: false }
  }
  // A repository cloned to try something out is not work for its owner:
  // only one with a commit of the person's own makes its owner a client.
  for (const repo of repos) {
    if (repo.owner && repo.worked && !you.has(orgName(repo.owner)) && answers[`owner:${orgName(repo.owner)}`]?.as !== 'none') {
      known.know(known.find(repo.owner) ?? repo.owner)
    }
  }

  // A project's owner: its repository's remote, a worktree answering for its
  // repository; failing that, its tickets.
  const repoOwner = new Map<string, Owner | null>()
  const workOwners = new Set<string>()
  for (const repo of repos) {
    if (!repo.owner) continue
    const answered = answers[`owner:${orgName(repo.owner)}`] !== undefined
    const owner = ownerOf(repo.owner)
    if (owner && !owner.personal && !repo.worked && !answered) continue
    repoOwner.set(repo.name, owner)
    if (!repoOwner.has(repo.main)) repoOwner.set(repo.main, owner)
    if (owner) workOwners.add(orgName(repo.owner))
  }
  const projectOwner = (project: string | null | undefined): Owner | undefined => {
    if (!project) return undefined
    const answer = said(`repo:${project}`, project)
    if (answer !== undefined) return answer ?? undefined
    if (repoOwner.has(project)) return repoOwner.get(project) ?? undefined
    const client = byProject.get(project)
    return client ? { org: client, personal: false } : undefined
  }

  const clients = new Map<string, TimesheetClient>()
  let personal: TimesheetClient | null = null
  const days = new Set<string>()
  let unassigned = 0
  let unassignedAgent = 0
  const leftovers = new Map<string, Leftover>()

  const add = (owner: Owner, day: string, line: Omit<TimesheetLine, 'seconds' | 'agentSeconds' | 'days'>,
    seconds: number, agent: number) => {
    let client: TimesheetClient
    if (owner.personal) {
      personal ??= { org: owner.org, seconds: 0, agentSeconds: 0, days: {}, lines: [] }
      client = personal
    } else {
      const id = orgName(owner.org)
      client = clients.get(id) ?? { org: owner.org, seconds: 0, agentSeconds: 0, days: {}, lines: [] }
      clients.set(id, client)
    }
    let row = client.lines.find((candidate) => candidate.what === line.what)
    if (!row) { row = { ...line, seconds: 0, agentSeconds: 0, days: {} }; client.lines.push(row) }
    if (line.label && !row.label) row.label = line.label
    row.seconds += seconds; row.agentSeconds += agent
    client.seconds += seconds; client.agentSeconds += agent
    if (seconds) {
      row.days[day] = (row.days[day] ?? 0) + seconds
      client.days[day] = (client.days[day] ?? 0) + seconds
    }
  }

  // A ticket named outside the browser, or by the branch: its owner is where
  // its prefix lives, or failing that the owner of the project it was in.
  const ticketOwner = (key: string, project?: string | null): Owner | undefined => {
    const home = homes.get(key.split('-')[0])?.org
    return home ? { org: home, personal: false } : projectOwner(project)
  }

  const focus: [number, number][] = []
  for (const block of all<{ started_at: number; ended_at: number; seconds: number; day: string; app: string; url: string | null; title: string | null; host: string | null }>(
    `select started_at, ended_at, seconds, day, app, url, title, host from blocks where day between ? and ? and idle = 0`, from, to)) {
    days.add(block.day)
    focus.push([block.started_at, block.ended_at])
    const page = readPage(block.url, block.title)
    if (page && NOISE.has(page.kind)) continue
    const window_ = labelKey(block)
    const project = labels.get(window_) ?? (aiWindows.has(window_) ? askedDuring(block.started_at, block.ended_at) : undefined)

    if (page?.org) {
      if (page.site !== 'github') {
        const answer = said(`site:${orgName(page.org)}`, page.org)
        if (answer !== null) {
          add(answer ?? { org: page.org, personal: false }, block.day, areaOf(page), block.seconds, 0)
          continue
        }
      } else if (you.has(orgName(page.org)) || workOwners.has(orgName(page.org)) || answers[`owner:${orgName(page.org)}`]) {
        // On GitHub, only an owner with work on this Mac is anyone's time.
        const owner = ownerOf(page.org)
        if (owner) {
          add(owner, block.day, areaOf(page), block.seconds, 0)
          continue
        }
      }
    }
    const key = page ? undefined : ticketKeys(block.title)[0] ?? onBranch(project, block.started_at)[0]
    const owner = key ? ticketOwner(key, project) : undefined
    if (key && owner) {
      add(owner, block.day, { what: key, kind: 'ticket' }, block.seconds, 0)
      continue
    }
    const forProject = projectOwner(project)
    if (forProject && project) {
      add(forProject, block.day, { what: project, kind: 'project' }, block.seconds, 0)
      continue
    }
    const place = placeOf(block)
    const forPlace = said(`place:${place}`, place)
    if (forPlace) {
      add(forPlace, block.day, { what: place, kind: 'area' }, block.seconds, 0)
      continue
    }
    const named = forPlace === null ? undefined : known.inText(block.title)
    if (named) {
      add({ org: named, personal: false }, block.day, { what: block.app, kind: 'area' }, block.seconds, 0)
      continue
    }
    // Last, what jev said when asked with the person's own context.
    const guessed = forPlace === null ? undefined : jevClient.get(window_)
    if (guessed) {
      add(guessed === PERSONAL ? { org: guessed, personal: true } : { org: known.find(guessed) ?? guessed, personal: false },
        block.day, { what: place, kind: 'area' }, block.seconds, 0)
      continue
    }
    unassigned += block.seconds
    // A place already said to be no one's work is not asked about again.
    if (forPlace === null) continue
    const leftover = leftovers.get(place) ?? { place, seconds: 0, category: categoryOf.get(window_) ?? null, windows: [] }
    leftover.seconds += block.seconds
    const window = leftover.windows.find((candidate) => candidate.key === window_)
    if (window) window.seconds += block.seconds
    else leftover.windows.push({ key: window_, app: block.app, title: block.title, seconds: block.seconds })
    leftovers.set(place, leftover)
  }

  // Meetings with guests, for the part of them the Mac saw no focus: that
  // time is already on its line. Two meetings at once are counted once.
  focus.sort((a, b) => a[0] - b[0])
  const covered: [number, number][] = []
  for (const span of focus) uncovered(covered, span[0], span[1])
  for (const meeting of all<{ started_at: number; ended_at: number; day: string; title: string | null; calendar: string | null; domains: string | null }>(
    `select started_at, ended_at, day, title, calendar, domains from meetings
     where day between ? and ? and attendees > 0 order by started_at`, from, to)) {
    const title = (meeting.title ?? '').trim()
    if (CANCELLED.test(title)) continue
    const end = Math.min(meeting.ended_at, now)
    if (end <= meeting.started_at) continue
    const seconds = uncovered(covered, meeting.started_at, end)
    if (seconds < 60) continue
    // A client's domain first; the person's own only when it is the only one.
    const domains: string[] = (() => { try { return JSON.parse(meeting.domains ?? '[]') } catch { return [] } })()
    const theirs = domains.filter((domain) => !yourDomains.has(domain)).map((domain) => known.inDomain(domain)).find(Boolean)
    const ours = domains.filter((domain) => yourDomains.has(domain)).map((domain) => known.inDomain(domain)).find(Boolean)
    const client = known.inText(title) ?? theirs ?? known.inText(meeting.calendar) ?? ours
    days.add(meeting.day)
    if (client) add({ org: client, personal: false }, meeting.day, { what: title.slice(0, 80) || 'meeting', kind: 'meeting' }, seconds, 0)
    else unassigned += seconds
  }

  // The agent's minutes, apart. Two agents in one minute on one line are one
  // minute, and a minute with no owner is said, not dropped.
  const counted = new Set<string>()
  for (const row of all<{ minute: number; project: string | null; day: string }>(
    `select minute, project, day from agent_minutes where day between ? and ?`, from, to)) {
    const key = onBranch(row.project, row.minute * 60)[0]
    const owner = key ? ticketOwner(key, row.project) : projectOwner(row.project)
    if (!owner) {
      const id = `${row.minute}:-`
      if (!counted.has(id)) { counted.add(id); unassignedAgent += 60 }
      continue
    }
    const line = key ? { what: key, kind: 'ticket' as const } : { what: row.project!, kind: 'project' as const }
    const id = `${row.minute}:${owner.personal ? 'you' : orgName(owner.org)}:${line.what}`
    if (counted.has(id)) continue
    counted.add(id)
    add(owner, row.day, line, 0, 60)
  }

  const sorted = (client: TimesheetClient) =>
    ({ ...client, lines: client.lines.sort((a, b) => b.seconds - a.seconds || b.agentSeconds - a.agentSeconds) })
  const ordered = [...clients.values()].map(sorted)
    .sort((a, b) => b.seconds - a.seconds || b.agentSeconds - a.agentSeconds)
  return {
    from, to, days: [...days].sort(), clients: ordered,
    personal: personal ? sorted(personal) : null, unassigned, unassignedAgent,
    leftovers: [...leftovers.values()].sort((a, b) => b.seconds - a.seconds).slice(0, 40)
      .map((leftover) => ({ ...leftover, windows: leftover.windows.sort((a, b) => b.seconds - a.seconds).slice(0, 8) })),
  }
}

const hm = (seconds: number) => {
  const minutes = Math.round(seconds / 60)
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`
}

/**
 * The draft as a Markdown table, for the conversation and the journal: one
 * row per line, a column per day, the total, and the agent's time apart. The
 * person's own work follows the clients, and what has no client comes last.
 */
export function timesheetTable(sheet: Timesheet,
  words: { client: string; total: string; agent: string; unassigned: string; personal: string }): string {
  const header = [words.client, ...sheet.days.map((day) => day.slice(5)), words.total, words.agent]
  const rows: string[][] = []
  const group = (client: TimesheetClient, name: string) => {
    rows.push([`**${name}**`, ...sheet.days.map((day) => (client.days[day] ? `**${hm(client.days[day])}**` : '')),
      `**${hm(client.seconds)}**`, client.agentSeconds ? hm(client.agentSeconds) : ''])
    for (const line of client.lines) {
      const label = line.label ? `${line.what} ${line.label}` : line.what
      rows.push([`${label.replace(/\|/g, '/').slice(0, 70)}`, ...sheet.days.map((day) => (line.days[day] ? hm(line.days[day]) : '')),
        hm(line.seconds), line.agentSeconds ? hm(line.agentSeconds) : ''])
    }
  }
  for (const client of sheet.clients) group(client, client.org)
  if (sheet.personal) group(sheet.personal, words.personal)
  if (sheet.unassigned || sheet.unassignedAgent) {
    rows.push([`_${words.unassigned}_`, ...sheet.days.map(() => ''),
      hm(sheet.unassigned), sheet.unassignedAgent ? hm(sheet.unassignedAgent) : ''])
  }
  return [header, header.map(() => '---'), ...rows].map((cells) => `| ${cells.join(' | ')} |`).join('\n')
}
