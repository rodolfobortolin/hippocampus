/**
 * What a URL is, as a piece of work rather than as an address.
 *
 * The collector already knows the tab behind most of the time spent in a
 * browser; on this machine, 82% of it. What it did with that was count the
 * host. A Jira ticket, a Confluence page, a pull request and a YouTube video
 * are different kinds of time, and the URL says which, and whose — the Jira
 * subdomain is the client, the GitHub owner is the organisation.
 *
 * One small reader per site, each a few lines, and anything none of them knows
 * falls back to its host. Nothing here opens the page or keeps what is on it:
 * an email is "email", never its subject.
 */

export type PageKind =
  | 'ticket' | 'board' | 'wiki' | 'space' | 'admin'
  | 'pull-request' | 'issue' | 'repo'
  | 'doc' | 'sheet' | 'slides' | 'design'
  | 'video' | 'mail' | 'meeting' | 'chat' | 'ai' | 'search' | 'docs'
  | 'sign-in' | 'page'

export type Page = {
  kind: PageKind
  /** Which product: jira, confluence, github, google-docs, figma… */
  site: string
  /** Whose: the tenant, workspace or owner the page belongs to. */
  org?: string
  /** A stable handle for the thing itself — SUP-12, acme/harbor#214, a doc id. */
  key?: string
  /** A readable name, from the page title when there is one. */
  label?: string
}

/** Prefixes that look like ticket keys and are not: GPT-5, UTF-8, ISO-8601… */
const NOT_A_TICKET = /^(GPT|UTF|ISO|SHA|MD|HTTP|HTTPS|TLS|SSL|CVE|RFC|IPV|MP|AES|RSA|WPA|ID|ES|COVID|RGB|HSL|WCAG|CSS|H|X|V|P|R|N|W)$/

/** Ticket keys in any text: a title, a commit message, a prompt, a branch. */
export function ticketKeys(text: string | null | undefined): string[] {
  if (!text) return []
  const found = new Set<string>()
  for (const match of text.matchAll(/\b([A-Z][A-Z0-9]{1,9})-(\d{1,6})\b/g)) {
    if (!NOT_A_TICKET.test(match[1])) found.add(`${match[1]}-${match[2]}`)
  }
  return [...found]
}

/** A window or tab title, without the browser's and the site's own suffixes. */
export function cleanTitle(title: string | null | undefined): string | undefined {
  if (!title) return undefined
  const clean = title
    .replace(/\s[-–—|]\s(Google Chrome|Safari|Arc|Brave|Firefox|Microsoft Edge)(\s[-–—]\s.*)?$/i, '')
    .replace(/\s[-–—|]\s(YouTube|Jira|Confluence|GitHub|Figma|Notion|Linear|Gmail|Google Docs|Google Sheets|Google Slides)$/i, '')
    .replace(/^\(\d+\)\s*/, '')
    .trim()
  return clean || undefined
}

const slugToWords = (slug: string) =>
  decodeURIComponent(slug).replace(/[+_-]+/g, ' ').replace(/\s+/g, ' ').trim()

type Reader = (url: URL, title?: string) => Page | null

/** Jira and Confluence, on Atlassian Cloud. The subdomain is whose it is. */
const atlassian: Reader = (url, title) => {
  const cloud = url.hostname.match(/^([a-z0-9-]+)\.atlassian\.net$/)
  if (!cloud) return null
  const org = cloud[1]
  const path = url.pathname
  const label = cleanTitle(title)

  const issue = path.match(/\/browse\/([A-Z][A-Z0-9]+-\d+)/)?.[1] ?? url.searchParams.get('selectedIssue') ?? undefined
  if (issue && ticketKeys(issue).length) return { kind: 'ticket', site: 'jira', org, key: issue, label }

  const page = path.match(/\/wiki\/spaces\/([^/]+)\/pages\/(\d+)(?:\/([^/?#]+))?/)
  if (page) {
    return { kind: 'wiki', site: 'confluence', org, key: `${page[1]}/${page[2]}`,
      label: label ?? (page[3] ? slugToWords(page[3]) : undefined) }
  }
  const space = path.match(/\/wiki\/spaces\/([^/]+)/)
  if (space) return { kind: 'space', site: 'confluence', org, key: space[1], label }
  if (path.startsWith('/wiki')) return { kind: 'page', site: 'confluence', org, label }

  // The administration: app configuration, fields, the plugin manager. For
  // someone who sets up Jira for a living this is the bulk of the time.
  const settings = path.match(/\/jira\/settings\/([^/]+)/)?.[1]
  if (settings) return { kind: 'admin', site: 'jira', org, key: settings, label }
  if (/\/plugins\/servlet\/(upm|ac\/)/.test(path) || path.startsWith('/secure/admin')) {
    return { kind: 'admin', site: 'jira', org, key: 'apps', label }
  }

  const board = path.match(/\/projects\/([A-Z][A-Z0-9]+)\/boards?/)?.[1]
  if (board) return { kind: 'board', site: 'jira', org, key: board, label }
  return { kind: 'page', site: 'jira', org, label }
}

const github: Reader = (url, title) => {
  if (url.hostname !== 'github.com') return null
  const [owner, repo, section, number] = url.pathname.split('/').filter(Boolean)
  const label = cleanTitle(title)
  if (!owner || ['settings', 'notifications', 'login', 'new', 'marketplace'].includes(owner)) {
    return { kind: 'page', site: 'github', label }
  }
  if (!repo) return { kind: 'page', site: 'github', org: owner, label }
  const full = `${owner}/${repo}`
  if (section === 'pull' && number) return { kind: 'pull-request', site: 'github', org: owner, key: `${full}#${number}`, label }
  if (section === 'issues' && number) return { kind: 'issue', site: 'github', org: owner, key: `${full}#${number}`, label }
  return { kind: 'repo', site: 'github', org: owner, key: full, label }
}

const google: Reader = (url, title) => {
  const host = url.hostname
  const label = cleanTitle(title)
  if (host === 'docs.google.com') {
    const doc = url.pathname.match(/\/(document|spreadsheets|presentation)\/d\/([^/]+)/)
    const kind: PageKind = doc?.[1] === 'spreadsheets' ? 'sheet' : doc?.[1] === 'presentation' ? 'slides' : 'doc'
    return { kind, site: 'google-docs', key: doc?.[2], label }
  }
  // Mail is mail. The subject in the title is someone else's words.
  if (host === 'mail.google.com') return { kind: 'mail', site: 'gmail' }
  if (host === 'meet.google.com') return { kind: 'meeting', site: 'google-meet' }
  if (host === 'gemini.google.com') return { kind: 'ai', site: 'gemini' }
  if (host === 'accounts.google.com') return { kind: 'sign-in', site: 'google' }
  if (/(^|\.)google\.[a-z.]+$/.test(host) && url.pathname.startsWith('/search')) return { kind: 'search', site: 'google' }
  return null
}

const youtube: Reader = (url, title) => {
  if (!/(^|\.)youtube\.com$/.test(url.hostname) && url.hostname !== 'youtu.be') return null
  const id = url.hostname === 'youtu.be' ? url.pathname.slice(1) : url.searchParams.get('v')
  if (!id) return { kind: 'page', site: 'youtube' }
  return { kind: 'video', site: 'youtube', key: id, label: cleanTitle(title) }
}

const figma: Reader = (url, title) => {
  if (!/(^|\.)figma\.com$/.test(url.hostname)) return null
  const file = url.pathname.match(/\/(?:file|design|proto|board)\/([^/]+)(?:\/([^/?#]+))?/)
  if (!file) return { kind: 'page', site: 'figma' }
  return { kind: 'design', site: 'figma', key: file[1], label: cleanTitle(title) ?? (file[2] ? slugToWords(file[2]) : undefined) }
}

const notion: Reader = (url, title) => {
  if (!/(^|\.)notion\.(so|site)$/.test(url.hostname)) return null
  const [workspace, slug] = url.pathname.split('/').filter(Boolean)
  const id = (slug ?? workspace ?? '').match(/([0-9a-f]{32})$/)?.[1]
  return { kind: 'doc', site: 'notion', org: slug ? workspace : undefined, key: id, label: cleanTitle(title) }
}

const linear: Reader = (url, title) => {
  if (url.hostname !== 'linear.app') return null
  const [team, section, key] = url.pathname.split('/').filter(Boolean)
  if (section === 'issue' && key && ticketKeys(key).length) {
    return { kind: 'ticket', site: 'linear', org: team, key, label: cleanTitle(title) }
  }
  return { kind: 'page', site: 'linear', org: team }
}

const elsewhere: Reader = (url) => {
  const host = url.hostname
  if (/(^|\.)zoom\.us$/.test(host) && /\/(j|wc|my)\//.test(url.pathname)) return { kind: 'meeting', site: 'zoom' }
  if (host === 'teams.microsoft.com' || host === 'teams.live.com') return { kind: 'meeting', site: 'teams' }
  if (/^outlook\.(office|live|office365)\.com$/.test(host)) return { kind: 'mail', site: 'outlook' }
  if (host === 'app.slack.com') return { kind: 'chat', site: 'slack' }
  if (host === 'claude.ai') return { kind: 'ai', site: 'claude' }
  if (host === 'chatgpt.com' || host === 'chat.openai.com') return { kind: 'ai', site: 'chatgpt' }
  if (host === 'developer.atlassian.com' || host === 'developer.mozilla.org' || host === 'stackoverflow.com'
    || /^docs\./.test(host)) return { kind: 'docs', site: host.replace(/^www\./, '') }
  return null
}

const READERS: Reader[] = [atlassian, github, google, youtube, figma, notion, linear, elsewhere]

/** Reads a URL into a piece of work. Null for something that is not a web page. */
export function readPage(address: string | null | undefined, title?: string | null): Page | null {
  if (!address) return null
  let url: URL
  try { url = new URL(address) } catch { return null }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  for (const reader of READERS) {
    const page = reader(url, title ?? undefined)
    if (page) return page
  }
  return { kind: 'page', site: url.hostname.replace(/^www\./, ''), label: cleanTitle(title) }
}
