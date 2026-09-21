import { all } from './db.ts'
import { readPage, ticketKeys, type Page, type PageKind } from './pages.ts'

/**
 * Pieces of work, gathered from every source that touched them.
 *
 * The app knew which app you were in. The identifiers that cross between
 * sources — a ticket key, a pull request, a document, a Confluence page — say
 * which piece of work it was: the same ticket shows up as a browser tab, in a
 * question to Claude Code and in a commit message, and here those become one
 * line with the time and the mentions added up.
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
  /** Times it was opened, from the browser history. */
  visits: number
  /** Commits whose message names it. */
  commits: number
  /** Questions to an agent that name it. */
  prompts: number
  /** The repository or project it was worked on in, from commits and prompts that name it. */
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
export type Org = { org: string; sites: string[]; seconds: number; visits: number; items: number }

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
    seconds: 0, visits: 0, commits: 0, prompts: 0, firstAt: at, lastAt: at,
  }
}

export type WorkItems = {
  items: Item[]
  orgs: Org[]
  /** Time per kind: how much of the browser was tickets, docs, mail, video. */
  kinds: { kind: PageKind; seconds: number; visits: number }[]
}

export function workItems(from: string, to: string): WorkItems {
  const items = new Map<string, Item>()
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

  // Time, from the samples: a tab read into a page, or — outside the browser —
  // a window whose title names a ticket.
  const blocks = all<{ started_at: number; seconds: number; url: string | null; title: string | null }>(
    `select started_at, seconds, url, title from blocks where day between ? and ? and idle = 0`, from, to)
  for (const block of blocks) {
    const page = readPage(block.url, block.title)
      ?? ticketPage(ticketKeys(block.title)[0], block.title)
    if (!page || NOISE.has(page.kind)) continue
    touch(page, block.started_at).seconds += block.seconds
  }

  // Visits, from the history — which reaches months before the samples do.
  const visits = all<{ ts: number; url: string; title: string | null }>(
    `select ts, url, title from visits where day between ? and ?`, from, to)
  for (const visit of visits) {
    const page = readPage(visit.url, visit.title)
    if (!page || NOISE.has(page.kind)) continue
    touch(page, visit.ts).visits++
  }

  // A ticket key seen in a browser teaches which site it lives on: every key
  // with that prefix is then attributed there, even when it only ever appears
  // in a commit or a prompt.
  const home = new Map<string, { site: string; org?: string }>()
  for (const item of items.values()) {
    if (item.kind === 'ticket' && item.key) home.set(item.key.split('-')[0], { site: item.site, org: item.org })
  }
  const mention = (key: string, at: number, project: string | null) => {
    const where = home.get(key.split('-')[0])
    const page: Page = { kind: 'ticket', site: where?.site ?? 'ticket', org: where?.org, key }
    const item = touch(page, at)
    // Where it was worked on: the repository of the commit, the project of the
    // question. The first one seen stays; they rarely disagree.
    if (project && !item.project) item.project = project
    return item
  }

  const commits = all<{ ts: number; subject: string | null; repo: string }>(
    `select ts, subject, repo from commits where day between ? and ?`, from, to)
  for (const commit of commits) for (const key of ticketKeys(commit.subject)) mention(key, commit.ts, commit.repo).commits++

  const prompts = all<{ ts: number; prompt: string | null; project: string | null }>(
    `select ts, prompt, project from ai_turns where day between ? and ?`, from, to)
  for (const turn of prompts) for (const key of ticketKeys(turn.prompt)) mention(key, turn.ts, turn.project).prompts++

  const list = [...items.values()].sort((a, b) =>
    b.seconds - a.seconds || b.visits - a.visits || (b.commits + b.prompts) - (a.commits + a.prompts))

  const orgs = new Map<string, Org>()
  const kinds = new Map<PageKind, { kind: PageKind; seconds: number; visits: number }>()
  for (const item of list) {
    const k = kinds.get(item.kind) ?? { kind: item.kind, seconds: 0, visits: 0 }
    k.seconds += item.seconds; k.visits += item.visits; kinds.set(item.kind, k)
    if (!item.org) continue
    const id = orgName(item.org)
    const o = orgs.get(id) ?? { org: item.org, sites: [], seconds: 0, visits: 0, items: 0 }
    if (!o.sites.includes(item.site)) o.sites.push(item.site)
    // The Atlassian subdomain is the most readable spelling of the name.
    if (item.site === 'jira' || item.site === 'confluence') o.org = item.org
    o.seconds += item.seconds; o.visits += item.visits; o.items++
    orgs.set(id, o)
  }

  return {
    items: list,
    orgs: [...orgs.values()].sort((a, b) => b.seconds - a.seconds || b.visits - a.visits),
    kinds: [...kinds.values()].sort((a, b) => b.seconds - a.seconds || b.visits - a.visits),
  }
}

/** A window outside the browser whose title names a ticket. */
function ticketPage(key: string | undefined, title: string | null): Page | null {
  return key ? { kind: 'ticket', site: 'ticket', key, label: title ?? undefined } : null
}

export type Touch = { at: number; source: 'window' | 'visit' | 'commit' | 'prompt'; seconds?: number; text?: string }

/**
 * One piece of work in detail: the totals, and every moment that touched it,
 * in order — the tab, the question to the agent, the commit. It is what "what
 * have I already done on SUP-1234?" needs.
 */
export function itemDetail(key: string, from: string, to: string): { item: Item | null; touches: Touch[] } {
  const item = workItems(from, to).items.find((candidate) => candidate.key === key) ?? null
  if (!item) return { item: null, touches: [] }
  const touches: Touch[] = []
  const same = (page: Page | null) => page?.key === key

  for (const block of all<{ started_at: number; seconds: number; url: string | null; title: string | null }>(
    `select started_at, seconds, url, title from blocks where day between ? and ? and idle = 0`, from, to)) {
    if (same(readPage(block.url, block.title)) || (!block.url && ticketKeys(block.title).includes(key))) {
      touches.push({ at: block.started_at, source: 'window', seconds: block.seconds, text: block.title ?? undefined })
    }
  }
  for (const visit of all<{ ts: number; url: string; title: string | null }>(
    `select ts, url, title from visits where day between ? and ?`, from, to)) {
    if (same(readPage(visit.url, visit.title))) touches.push({ at: visit.ts, source: 'visit', text: visit.title ?? undefined })
  }
  for (const commit of all<{ ts: number; subject: string | null; repo: string }>(
    `select ts, subject, repo from commits where day between ? and ?`, from, to)) {
    if (ticketKeys(commit.subject).includes(key)) touches.push({ at: commit.ts, source: 'commit', text: `${commit.repo}: ${commit.subject}` })
  }
  for (const turn of all<{ ts: number; prompt: string | null }>(
    `select ts, prompt from ai_turns where day between ? and ?`, from, to)) {
    if (ticketKeys(turn.prompt).includes(key)) touches.push({ at: turn.ts, source: 'prompt', text: turn.prompt?.slice(0, 200) })
  }
  return { item, touches: touches.sort((a, b) => a.at - b.at) }
}
