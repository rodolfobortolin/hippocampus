import { dayOf } from './config.ts'
import { all } from './db.ts'
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
 * Every second of focus lands on one line at most, in this order: a page that
 * names its owner (a Jira ticket, a Confluence space, a repository), a ticket
 * named by a window title or by the branch the code was on, and last the
 * project the window was labelled with — whose client is the one its tickets
 * belong to. The agent's minutes are counted apart: time delegated is not time
 * at the keyboard, and whether it is billable is the person's call.
 */

export type TimesheetLine = {
  /** A ticket key, or an area such as "confluence · KB" or "project harbor". */
  what: string
  kind: 'ticket' | 'area' | 'project'
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
  /** Focus with no client to put it on. */
  unassigned: number
}

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
 * Which client each project works for: the owner most of its tickets belong
 * to, over the three months before the week. A project whose tickets split
 * between clients goes to the larger share — rare, and visible in the lines.
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

export function timesheet(from: string, to: string): Timesheet {
  const { prefixes, homes } = ticketKnowledge()
  const branchAt = branchLookup()
  const byProject = projectClients(to)
  const labels = new Map(all<{ key: string; project: string }>(
    `select key, project from labels where project is not null and project <> ''`).map((row) => [row.key, row.project]))
  const onBranch = (repo: string | null | undefined, at: number) =>
    branchKeys(branchAt(repo, at)).filter((key) => prefixes.has(key.split('-')[0]))

  const clients = new Map<string, TimesheetClient>()
  const days = new Set<string>()
  let unassigned = 0

  const add = (org: string, day: string, line: Omit<TimesheetLine, 'seconds' | 'agentSeconds' | 'days'>,
    seconds: number, agent: number) => {
    const id = orgName(org)
    const client = clients.get(id) ?? { org, seconds: 0, agentSeconds: 0, days: {}, lines: [] }
    let row = client.lines.find((candidate) => candidate.what === line.what)
    if (!row) { row = { ...line, seconds: 0, agentSeconds: 0, days: {} }; client.lines.push(row) }
    if (line.label && !row.label) row.label = line.label
    row.seconds += seconds; row.agentSeconds += agent
    client.seconds += seconds; client.agentSeconds += agent
    if (seconds) {
      row.days[day] = (row.days[day] ?? 0) + seconds
      client.days[day] = (client.days[day] ?? 0) + seconds
    }
    clients.set(id, client)
  }

  // A ticket named outside the browser, or by the branch: its owner is where
  // its prefix lives, or failing that the client of the project it was in.
  const ticketOwner = (key: string, project?: string | null) =>
    homes.get(key.split('-')[0])?.org ?? (project ? byProject.get(project) : undefined)

  for (const block of all<{ started_at: number; seconds: number; day: string; app: string; url: string | null; title: string | null; host: string | null }>(
    `select started_at, seconds, day, app, url, title, host from blocks where day between ? and ? and idle = 0`, from, to)) {
    days.add(block.day)
    const page = readPage(block.url, block.title)
    if (page && NOISE.has(page.kind)) continue
    const project = labels.get(labelKey(block))

    if (page?.org) {
      add(page.org, block.day, areaOf(page), block.seconds, 0)
      continue
    }
    const key = page ? undefined : ticketKeys(block.title)[0] ?? onBranch(project, block.started_at)[0]
    const owner = key ? ticketOwner(key, project) : undefined
    if (key && owner) {
      add(owner, block.day, { what: key, kind: 'ticket' }, block.seconds, 0)
      continue
    }
    const client = project ? byProject.get(project) : undefined
    if (client && project) {
      add(client, block.day, { what: project, kind: 'project' }, block.seconds, 0)
      continue
    }
    unassigned += block.seconds
  }

  // The agent's minutes, apart. Two agents in one minute on one line are one minute.
  const counted = new Set<string>()
  for (const row of all<{ minute: number; project: string | null; day: string }>(
    `select minute, project, day from agent_minutes where day between ? and ?`, from, to)) {
    const key = onBranch(row.project, row.minute * 60)[0]
    const owner = key ? ticketOwner(key, row.project) : row.project ? byProject.get(row.project) : undefined
    if (!owner) continue
    const line = key ? { what: key, kind: 'ticket' as const } : { what: row.project!, kind: 'project' as const }
    const id = `${row.minute}:${orgName(owner)}:${line.what}`
    if (counted.has(id)) continue
    counted.add(id)
    add(owner, row.day, line, 0, 60)
  }

  const list = [...clients.values()]
    .map((client) => ({ ...client, lines: client.lines.sort((a, b) => b.seconds - a.seconds || b.agentSeconds - a.agentSeconds) }))
    .sort((a, b) => b.seconds - a.seconds || b.agentSeconds - a.agentSeconds)
  return { from, to, days: [...days].sort(), clients: list, unassigned }
}

const hm = (seconds: number) => {
  const minutes = Math.round(seconds / 60)
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`
}

/**
 * The draft as a Markdown table, for the conversation and the journal: one
 * row per line, a column per day, the total, and the agent's time apart.
 */
export function timesheetTable(sheet: Timesheet, words: { client: string; total: string; agent: string; unassigned: string }): string {
  const header = [words.client, ...sheet.days.map((day) => day.slice(5)), words.total, words.agent]
  const rows: string[][] = []
  for (const client of sheet.clients) {
    rows.push([`**${client.org}**`, ...sheet.days.map((day) => (client.days[day] ? `**${hm(client.days[day])}**` : '')),
      `**${hm(client.seconds)}**`, client.agentSeconds ? hm(client.agentSeconds) : ''])
    for (const line of client.lines) {
      const name = line.label ? `${line.what} ${line.label}` : line.what
      rows.push([`${name.replace(/\|/g, '/').slice(0, 70)}`, ...sheet.days.map((day) => (line.days[day] ? hm(line.days[day]) : '')),
        hm(line.seconds), line.agentSeconds ? hm(line.agentSeconds) : ''])
    }
  }
  if (sheet.unassigned) rows.push([`_${words.unassigned}_`, ...sheet.days.map(() => ''), hm(sheet.unassigned), ''])
  return [header, header.map(() => '---'), ...rows].map((cells) => `| ${cells.join(' | ')} |`).join('\n')
}
