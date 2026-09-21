import { readPage, type PageKind } from './pages.ts'

/**
 * Categories the app can settle on its own, with no model asked.
 *
 * An editor is code, Slack is communication, Figma is design — whatever the
 * window says. Those windows never needed a classifier, and without one (no
 * jev key, the fully local mode) they used to read "unlabelled", which left
 * the day's focus empty for someone who spent it in an editor.
 *
 * Only the certain cases are here. A browser tab is settled by what the page
 * is — a pull request, a search, an email — and left alone when the page could
 * be either work or leisure: a video, an unknown site, a ticket. Anything not
 * certain stays unlabelled rather than guessed, as it always has.
 */

type Category = 'code' | 'ai' | 'research' | 'communication' | 'writing' | 'design' | 'admin'

const APPS: Record<Category, string[]> = {
  code: [
    'code', 'visual studio code', 'cursor', 'zed', 'xcode', 'intellij idea', 'webstorm', 'pycharm', 'goland',
    'rider', 'android studio', 'sublime text', 'nova', 'windsurf', 'fleet', 'terminal', 'iterm2', 'ghostty',
    'warp', 'alacritty', 'kitty', 'wezterm', 'hyper', 'tableplus', 'postico', 'sequel ace', 'github desktop',
    'tower', 'fork', 'docker desktop',
  ],
  ai: ['claude', 'chatgpt', 'codex', 'perplexity'],
  communication: [
    'slack', 'microsoft teams', 'teams', 'zoom.us', 'discord', 'whatsapp', 'telegram', 'messages', 'signal',
    'mail', 'microsoft outlook', 'spark', 'mimestream', 'facetime',
  ],
  design: [
    'figma', 'sketch', 'pixelmator pro', 'affinity designer', 'affinity photo', 'adobe photoshop',
    'adobe illustrator', 'blender', 'final cut pro', 'davinci resolve',
  ],
  writing: ['obsidian', 'bear', 'ulysses', 'pages', 'microsoft word', 'ia writer', 'craft', 'notion'],
  // This app too: reading your own day back is looking after how you work, not
  // doing it — and jev, asked, filed half an hour of it as "unlabelled".
  admin: ['system settings', 'finder', 'activity monitor', 'app store', '1password', 'keychain access', 'installer', 'hippocampus'],
  research: [],
}

const BY_APP = new Map<string, Category>(
  Object.entries(APPS).flatMap(([category, apps]) => apps.map((app) => [app, category as Category])))

/** What a page is, when that is enough to say what the time was. */
const BY_PAGE: Partial<Record<PageKind, Category>> = {
  'pull-request': 'code', issue: 'code', repo: 'code',
  ai: 'ai',
  mail: 'communication', chat: 'communication', meeting: 'communication',
  doc: 'writing', sheet: 'writing', slides: 'writing',
  design: 'design',
  docs: 'research', search: 'research', wiki: 'research', space: 'research',
  admin: 'admin', 'sign-in': 'admin',
}

export type LocalLabel = { category: Category; project: string | null }

/**
 * The label a window gets without a model, or null when only a model could
 * tell. The project is taken only when a part of the title is exactly the
 * name of a project the app already knows — "orders.ts — harbor" is harbor;
 * a title that merely resembles a name is not.
 */
export function localLabel(
  window: { app: string | null; title: string | null; url?: string | null },
  projects: string[],
): LocalLabel | null {
  // Some apps carry an invisible mark before their name (‎WhatsApp).
  const app = (window.app ?? '').replace(/[‎‏]/g, '').trim().toLowerCase()
  const page = readPage(window.url ?? null, window.title)
  const category = page ? BY_PAGE[page.kind] : BY_APP.get(app)
  if (!category) return null

  const known = new Map(projects.map((name) => [name.toLowerCase(), name]))
  const project = (window.title ?? '')
    .split(/\s+[—–-]\s+/)
    .map((part) => known.get(part.trim().toLowerCase()))
    .find(Boolean) ?? null
  return { category, project }
}
