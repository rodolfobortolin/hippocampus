import { all } from './db.ts'
import { labelKey } from './jev.ts'
import { readPage, ticketKeys, branchKeys, type Page, type PageKind } from './pages.ts'

/**
 * Pieces of work, gathered from every source that touched them.
 *
 * The app knew which app you were in. The identifiers that cross between
 * sources — a ticket key, a pull request, a document, a Confluence page — say
 * which piece of work it was: the same ticket shows up as a browser tab, in a
 * question to Claude Code and in a commit message, and here those become one
 * line with the time and the mentions added up.
 *
 * The branch a repository was on joins in what names nothing. A question to
 * the agent, a commit or a stretch in the editor while the code sat on
 * feature/sup-12-login belongs to SUP-12 whether or not its text says so.
 *
 * Nothing assumes a particular way of working. A consultant's data fills the
 * ticket and client columns; a designer's fills the Figma files; someone who
 * writes fills the documents. The screens show whichever axis is there.
 */

export type Item = {
  id: string
  kind: PageKind
  site: string
  org?: string
  key?: string
  label?: string
  /** Time with it in front, from the focus samples. */
  seconds: number
  /** Time an agent spent working on it, with or without you at the machine. */
  agentSeconds: number
  /** Times it was opened, from the browser history. */
  visits: number
  /** Commits that name it, or were made on a branch that does. */
  commits: number
  /** Questions to an agent that name it, or were asked on a branch that does. */
  prompts: number
  /** The repository or project it was worked on in. */
  project?: string
  firstAt: number
  lastAt: number
}

/**
 * Whose work it was, across products.
 *
 * The same client shows up as `jira · acme`, `confluence · acme` and
 * `github · Acme-Corp`. Jira and Confluence on one Atlassian subdomain are the
 * same tenant, always; an owner elsewhere whose name reduces to the same
 * letters is taken to be the same one too — which is right far more often
 * than not, and the sites it merged are listed, so a wrong merge is visible.
 */
export type Org = {
  org: string; sites: string[]; items: number
  seconds: number; agentSeconds: number; visits: number; commits: number; prompts: number
}

/** "Synapse-Oasis", "synapseoasis" and "synapse_oasis" are one name. */
export const orgName = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '')

/** Kinds that name one specific thing, worth a line of their own. */
const SPECIFIC = new Set<PageKind>(['ticket', 'wiki', 'pull-request', 'issue', 'doc', 'sheet', 'slides', 'design', 'video', 'repo', 'board', 'space'])
/** Kinds that are not work anyone would want listed. */
const NOISE = new Set<PageKind>(['sign-in'])

function idOf(page: Page): string {
  if (SPECIFIC.has(page.kind) && page.key) return `${page.site}:${page.org ?? ''}:${page.key}`
  // Everything else groups by what it is and whose: "Jira settings on acme",
  // "Google search", "email", "example.org".
  return `${page.site}:${page.org ?? ''}:${page.kind}${page.kind === 'admin' && page.key ? `:${page.key}` : ''}`
}

function blank(page: Page, at: number): Item {
  return {
    id: idOf(page), kind: page.kind, site: page.site, org: page.org,
    key: SPECIFIC.has(page.kind) || page.kind === 'admin' ? page.key : undefined,
    label: SPECIFIC.has(page.kind) ? page.label : undefined,
    seconds: 0, agentSeconds: 0, visits: 0, commits: 0, prompts: 0, firstAt: at, lastAt: at,
  }
}

export type WorkItems = {
  /**
   * The first day with focus samples. Visits reach months further back, so a
   * range that starts earlier can only be compared across its whole length
   * by visits — time would favour whatever happened after the collector began.
   */
  timeSince: string | null
  items: Item[]
  orgs: Org[]
  /** Time per kind: how much of the browser was tickets, docs, mail, video. */
  kinds: { kind: PageKind; seconds: number; visits: number }[]
}

export type Touch = {
  at: number
  source: 'window' | 'visit' | 'commit' | 'prompt' | 'branch' | 'agent'
  seconds?: number
  text?: string
}

/**
 * Where each repository's HEAD was at a given moment.
 *
 * Before the first switch the reflog remembers, the branch is the one that
 * switch moved away from.
 */
function branchLookup(): (repo: string | null | undefined, at: number) => string | null {
  const moves = new Map<string, { ts: number; branch: string; from: string | null }[]>()
  for (const row of all<{ repo: string; ts: number; branch: string; from_branch: string | null }>(
    `select repo, ts, branch, from_branch from branches order by repo, ts`)) {
    const list = moves.get(row.repo) ?? []
    list.push({ ts: row.ts, branch: row.branch, from: row.from_branch })
    moves.set(row.repo, list)
  }
  return (repo, at) => {
    const list = repo ? moves.get(repo) : undefined
    if (!list?.length) return null
    let low = 0, high = list.length - 1, found = -1
    while (low <= high) {
      const middle = (low + high) >> 1
      if (list[middle].ts <= at) { found = middle; low = middle + 1 } else high = middle - 1
    }
    return found >= 0 ? list[found].branch : list[0].from
  }
}

/**
 * What the whole database knows about ticket keys, whatever the range.
 *
 * Which prefixes are really tickets: the ones written in upper case where a
 * key would be — a Jira address, a commit, a question. A branch called
 * release-2 is not a ticket; one called vpd-59-catalog is, because VPD-59 is
 * written that way in the commits.
 *
 * And where each prefix lives: any Jira address that names one of its keys —
 * in the browser history, or pasted into a question or a commit message —
 * says which site and whose. The most frequent one wins.
 */
function ticketKnowledge(): { prefixes: Set<string>; homes: Map<string, { site: string; org?: string }> } {
  const prefixes = new Set<string>()
  const seen = new Map<string, Map<string, { site: string; org?: string; n: number }>>()
  const learn = (address: string) => {
    const page = readPage(address)
    if (page?.kind !== 'ticket' || !page.key) return
    const prefix = page.key.split('-')[0]
    const places = seen.get(prefix) ?? new Map()
    const id = `${page.site}:${page.org ?? ''}`
    const place = places.get(id) ?? { site: page.site, org: page.org, n: 0 }
    place.n++
    places.set(id, place)
    seen.set(prefix, places)
  }
  for (const row of all<{ text: string | null; address: number }>(
    `select subject text, 0 address from commits
     union all select prompt, 0 from ai_turns
     union all select url, 1 from visits where url like '%/browse/%' or url like '%selectedIssue=%'`)) {
    for (const key of ticketKeys(row.text)) prefixes.add(key.split('-')[0])
    if (row.address) learn(row.text ?? '')
    else if (row.text?.includes('://')) for (const address of row.text.match(/https?:\/\/[^\s<>()\]\["']+/g) ?? []) learn(address)
  }
  const homes = new Map<string, { site: string; org?: string }>()
  for (const [prefix, places] of seen) {
    const best = [...places.values()].sort((a, b) => b.n - a.n)[0]
    homes.set(prefix, { site: best.site, org: best.org })
  }
  return { prefixes, homes }
}

type Gathered = { items: Map<string, Item>; touches: Touch[] }

/**
 * The one pass behind both the list and the detail, so the detail of a ticket
 * can never disagree with its line: `only` names the key whose moments are
 * written down as they are counted.
 */
function gather(from: string, to: string, only?: string): Gathered {
  const items = new Map<string, Item>()
  const touches: Touch[] = []
  const touch = (page: Page, at: number) => {
    const id = idOf(page)
    const item = items.get(id) ?? blank(page, at)
    // The latest readable name wins: titles improve as a page loads.
    if (page.label && SPECIFIC.has(page.kind)) item.label = page.label
    item.firstAt = Math.min(item.firstAt, at)
    item.lastAt = Math.max(item.lastAt, at)
    items.set(id, item)
    return item
  }
  const note = (item: Item, moment: Touch) => { if (only && item.key === only) touches.push(moment) }

  // Time, from the samples. A tab is read into a page now; a window outside
  // the browser waits until it is known where its ticket lives.
  const outside: { at: number; seconds: number; title: string | null; project?: string }[] = []
  const projects = new Map(all<{ key: string; project: string }>(
    `select key, project from labels where project is not null and project <> ''`).map((row) => [row.key, row.project]))
  for (const block of all<{ started_at: number; seconds: number; app: string; url: string | null; title: string | null; host: string | null }>(
    `select started_at, seconds, app, url, title, host from blocks where day between ? and ? and idle = 0`, from, to)) {
    const page = readPage(block.url, block.title)
    if (!page) {
      outside.push({ at: block.started_at, seconds: block.seconds, title: block.title, project: projects.get(labelKey(block)) })
      continue
    }
    if (NOISE.has(page.kind)) continue
    const item = touch(page, block.started_at)
    item.seconds += block.seconds
    note(item, { at: block.started_at, source: 'window', seconds: block.seconds, text: block.title ?? undefined })
  }

  // Visits, from the history — which reaches months before the samples do.
  for (const visit of all<{ ts: number; url: string; title: string | null }>(
    `select ts, url, title from visits where day between ? and ?`, from, to)) {
    const page = readPage(visit.url, visit.title)
    if (!page || NOISE.has(page.kind)) continue
    const item = touch(page, visit.ts)
    item.visits++
    note(item, { at: visit.ts, source: 'visit', text: visit.title ?? undefined })
  }

  // Where each prefix lives: every key with it is attributed there, even when
  // it only ever appears in a commit, a prompt or a branch.
  const { prefixes, homes: home } = ticketKnowledge()
  const ticket = (key: string, at: number, project?: string | null) => {
    const where = home.get(key.split('-')[0])
    const item = touch({ kind: 'ticket', site: where?.site ?? 'ticket', org: where?.org, key }, at)
    // Where it was worked on: the repository of the commit, the project of the
    // question. The first one seen stays; they rarely disagree.
    if (project && !item.project) item.project = project
    return item
  }

  const branchAt = branchLookup()
  const onBranch = (repo: string | null | undefined, at: number) =>
    branchKeys(branchAt(repo, at)).filter((key) => prefixes.has(key.split('-')[0]))
  // What a text names, and what the branch it was written on names, once each.
  const keysOf = (text: string | null, repo: string | null | undefined, at: number) =>
    [...new Set([...ticketKeys(text), ...onBranch(repo, at)])]

  for (const block of outside) {
    const key = ticketKeys(block.title)[0] ?? onBranch(block.project, block.at)[0]
    if (!key) continue
    const item = ticket(key, block.at, block.project)
    item.seconds += block.seconds
    note(item, { at: block.at, source: 'window', seconds: block.seconds, text: block.title ?? undefined })
  }

  for (const commit of all<{ ts: number; subject: string | null; repo: string }>(
    `select ts, subject, repo from commits where day between ? and ?`, from, to)) {
    for (const key of keysOf(commit.subject, commit.repo, commit.ts)) {
      const item = ticket(key, commit.ts, commit.repo)
      item.commits++
      note(item, { at: commit.ts, source: 'commit', text: `${commit.repo}: ${commit.subject}` })
    }
  }

  for (const turn of all<{ ts: number; prompt: string | null; project: string | null }>(
    `select ts, prompt, project from ai_turns where day between ? and ?`, from, to)) {
    for (const key of keysOf(turn.prompt, turn.project, turn.ts)) {
      const item = ticket(key, turn.ts, turn.project)
      item.prompts++
      note(item, { at: turn.ts, source: 'prompt', text: turn.prompt?.slice(0, 200) })
    }
  }

  // The agent's own minutes, on the branch its project was on. Two agents in
  // the same minute on the same ticket are one minute of it.
  const counted = new Set<string>()
  const runs = new Map<string, Touch>()
  for (const row of all<{ minute: number; project: string | null }>(
    `select minute, project from agent_minutes where day between ? and ? order by minute`, from, to)) {
    for (const key of onBranch(row.project, row.minute * 60)) {
      if (counted.has(`${row.minute}:${key}`)) continue
      counted.add(`${row.minute}:${key}`)
      const item = ticket(key, row.minute * 60, row.project)
      item.agentSeconds += 60
      // In the detail, a run of minutes is one moment, not sixty.
      const run = runs.get(key)
      if (run && row.minute * 60 - (run.at + (run.seconds ?? 0)) <= 120) run.seconds = row.minute * 60 + 60 - run.at
      else if (only && key === only) {
        const moment: Touch = { at: row.minute * 60, source: 'agent', seconds: 60, text: row.project ?? undefined }
        runs.set(key, moment)
        note(item, moment)
      }
    }
  }

  // The switches themselves, in the detail: when work on it began in a repository.
  if (only) {
    for (const move of all<{ repo: string; ts: number; branch: string; from_branch: string | null }>(
      `select repo, ts, branch, from_branch from branches where day between ? and ? order by ts`, from, to)) {
      if (branchKeys(move.branch).includes(only)) {
        touches.push({ at: move.ts, source: 'branch', text: `${move.repo}: ${move.from_branch ?? '?'} → ${move.branch}` })
      }
    }
  }

  return { items, touches }
}

export function workItems(from: string, to: string): WorkItems {
  const list = [...gather(from, to).items.values()].sort((a, b) =>
    b.seconds - a.seconds || b.agentSeconds - a.agentSeconds || b.visits - a.visits
    || (b.commits + b.prompts) - (a.commits + a.prompts))

  const orgs = new Map<string, Org>()
  const kinds = new Map<PageKind, { kind: PageKind; seconds: number; visits: number }>()
  for (const item of list) {
    const k = kinds.get(item.kind) ?? { kind: item.kind, seconds: 0, visits: 0 }
    k.seconds += item.seconds; k.visits += item.visits; kinds.set(item.kind, k)
    if (!item.org) continue
    const id = orgName(item.org)
    const o = orgs.get(id) ?? { org: item.org, sites: [], items: 0, seconds: 0, agentSeconds: 0, visits: 0, commits: 0, prompts: 0 }
    if (!o.sites.includes(item.site)) o.sites.push(item.site)
    // The Atlassian subdomain is the most readable spelling of the name.
    if (item.site === 'jira' || item.site === 'confluence') o.org = item.org
    o.seconds += item.seconds; o.agentSeconds += item.agentSeconds; o.visits += item.visits
    o.commits += item.commits; o.prompts += item.prompts; o.items++
    orgs.set(id, o)
  }

  return {
    timeSince: (all<{ day: string | null }>(`select min(day) day from blocks`)[0]?.day) ?? null,
    items: list,
    orgs: [...orgs.values()].sort((a, b) => b.seconds + b.agentSeconds - a.seconds - a.agentSeconds
      || b.visits + b.commits + b.prompts - a.visits - a.commits - a.prompts),
    kinds: [...kinds.values()].sort((a, b) => b.seconds - a.seconds || b.visits - a.visits),
  }
}

/**
 * One piece of work in detail: the totals, and every moment that touched it,
 * in order — the tab, the branch, the question to the agent, the agent's
 * stretch of work, the commit. It is what "what have I already done on
 * SUP-1234?" needs.
 */
export function itemDetail(key: string, from: string, to: string): { item: Item | null; touches: Touch[] } {
  const { items, touches } = gather(from, to, key)
  const item = [...items.values()].find((candidate) => candidate.key === key) ?? null
  if (!item) return { item: null, touches: [] }
  return { item, touches: touches.sort((a, b) => a.at - b.at) }
}
