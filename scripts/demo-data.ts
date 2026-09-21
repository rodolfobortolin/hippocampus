// A believable three weeks of someone's work, for screenshots and the website.
//
// Everything here is invented: the person, the projects, the windows, the
// commits. The point is to show what the app draws without publishing anyone's
// real day — a real database carries client names, ticket numbers and the
// titles of whatever was open, and none of that belongs on a public page.
//
// Usage:
//   HIPPOCAMPUS_DATA=/tmp/hippocampus-demo node --experimental-strip-types scripts/demo-data.ts
//
// It refuses to run against the real data folder.

import os from 'node:os'
import path from 'node:path'

const target = (process.env.HIPPOCAMPUS_DATA ?? '').trim()
const real = path.join(os.homedir(), 'Library', 'Application Support', 'Hippocampus')
if (!target || path.resolve(target) === path.resolve(real)) {
  console.error('Set HIPPOCAMPUS_DATA to an empty folder of its own. This never writes to the real database.')
  process.exit(1)
}

const { db, setMeta } = await import('../core/db.ts')
const { labelKey } = await import('../core/jev.ts')
const { dayOf } = await import('../core/config.ts')

// A fixed seed, so the screenshots come out the same every time they are taken.
let seed = 20260921
const random = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296)
const pick = <T>(items: T[]): T => items[Math.floor(random() * items.length)]
const between = (low: number, high: number) => low + random() * (high - low)

type Window = {
  app: string; bundle: string; title: string; host?: string; url?: string
  category: string; project: string | null; writing: number; screen?: string
}

const DISPLAY = 'Studio Display'
const LAPTOP = 'Built-in Retina Display'

const WINDOWS: Window[] = [
  { app: 'Code', bundle: 'com.microsoft.VSCode', title: 'orders.ts — harbor', category: 'code', project: 'harbor', writing: 0.8 },
  { app: 'Code', bundle: 'com.microsoft.VSCode', title: 'pagination.test.ts — harbor', category: 'code', project: 'harbor', writing: 0.75 },
  { app: 'Code', bundle: 'com.microsoft.VSCode', title: 'Checkout.tsx — atlas', category: 'code', project: 'atlas', writing: 0.8 },
  { app: 'Code', bundle: 'com.microsoft.VSCode', title: 'theme.css — atlas', category: 'code', project: 'atlas', writing: 0.7 },
  { app: 'Terminal', bundle: 'com.apple.Terminal', title: 'harbor — npm test', category: 'code', project: 'harbor', writing: 0.55 },
  { app: 'Terminal', bundle: 'com.apple.Terminal', title: 'atlas — git', category: 'code', project: 'atlas', writing: 0.5 },
  { app: 'Claude', bundle: 'com.anthropic.claudefordesktop', title: 'Claude', category: 'ai', project: 'harbor', writing: 0.65 },
  { app: 'Claude', bundle: 'com.anthropic.claudefordesktop', title: 'Claude', category: 'ai', project: 'atlas', writing: 0.65 },
  { app: 'Google Chrome', bundle: 'com.google.Chrome', title: 'Pull request #214 · acme/harbor', host: 'github.com', url: 'https://github.com/acme/harbor/pull/214', category: 'code', project: 'harbor', writing: 0.3 },
  { app: 'Google Chrome', bundle: 'com.google.Chrome', title: 'Pull request #88 · acme/atlas', host: 'github.com', url: 'https://github.com/acme/atlas/pull/88', category: 'code', project: 'atlas', writing: 0.3 },
  { app: 'Google Chrome', bundle: 'com.google.Chrome', title: 'Array.prototype.flatMap() - MDN', host: 'developer.mozilla.org', url: 'https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array/flatMap', category: 'research', project: 'atlas', writing: 0.05 },
  { app: 'Google Chrome', bundle: 'com.google.Chrome', title: 'Orders API: cursor pagination - Engineering - Confluence', host: 'acme.atlassian.net', url: 'https://acme.atlassian.net/wiki/spaces/ENG/pages/2211/Orders+API+cursor+pagination', category: 'writing', project: 'harbor', writing: 0.5 },
  { app: 'Google Chrome', bundle: 'com.google.Chrome', title: '[HAR-142] Cursor pagination for GET /orders - Jira', host: 'acme.atlassian.net', url: 'https://acme.atlassian.net/browse/HAR-142', category: 'research', project: 'harbor', writing: 0.25 },
  { app: 'Google Chrome', bundle: 'com.google.Chrome', title: 'Inbox (3) - alex@acme.dev', host: 'mail.google.com', url: 'https://mail.google.com/mail/u/0/', category: 'communication', project: null, writing: 0.4 },
  { app: 'Google Chrome', bundle: 'com.google.Chrome', title: 'Best espresso grinders under $300 - YouTube', host: 'youtube.com', url: 'https://youtube.com/watch?v=demo2', category: 'distraction', project: null, writing: 0.02 },
  { app: 'Figma', bundle: 'com.figma.Desktop', title: 'Checkout — v3', category: 'design', project: 'atlas', writing: 0.2 },
  { app: 'Slack', bundle: 'com.tinyspeck.slackmacgap', title: '#harbor-dev — acme', category: 'communication', project: 'harbor', writing: 0.55 },
  { app: 'Slack', bundle: 'com.tinyspeck.slackmacgap', title: '#design — acme', category: 'communication', project: 'atlas', writing: 0.5 },
  { app: 'zoom.us', bundle: 'us.zoom.xos', title: 'Zoom Meeting', category: 'communication', project: null, writing: 0.05 },
  { app: 'Google Chrome', bundle: 'com.google.Chrome', title: '[GLX-17] Reconciliation drifts by one cent - Jira', host: 'globex.atlassian.net', url: 'https://globex.atlassian.net/browse/GLX-17', category: 'admin', project: 'ledger', writing: 0.3 },
]

// How the day tends to go: deep code in the morning, talk after lunch, a mix
// late in the afternoon. Weights, not a script — every day comes out different.
function windowFor(hour: number): Window {
  const code = WINDOWS.filter((w) => w.category === 'code')
  const ai = WINDOWS.filter((w) => w.category === 'ai')
  const talk = WINDOWS.filter((w) => w.category === 'communication')
  const other = WINDOWS.filter((w) => !['code', 'ai', 'communication'].includes(w.category))
  const r = random()
  if (hour < 12) return r < 0.55 ? pick(code) : r < 0.78 ? pick(ai) : r < 0.9 ? pick(other) : pick(talk)
  if (hour < 15) return r < 0.3 ? pick(talk) : r < 0.55 ? pick(code) : r < 0.75 ? pick(ai) : pick(other)
  return r < 0.4 ? pick(code) : r < 0.6 ? pick(ai) : r < 0.78 ? pick(talk) : pick(other)
}

const insertBlock = db.prepare(`
  insert into blocks (started_at, ended_at, seconds, day, app, bundle, title, url, host, idle,
                      keys, clicks, scroll, mic, screen, sound, media, playing)
  values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
const insertLabel = db.prepare(`
  insert or replace into labels (key, app, sample_title, category, project, deep_work, confidence, model, created_at)
  values (?, ?, ?, ?, ?, ?, ?, 'demo', ?)`)
const insertVisit = db.prepare(`insert or ignore into visits (ts, day, browser, url, host, title) values (?, ?, 'Chrome', ?, ?, ?)`)
const insertCommit = db.prepare(`
  insert or ignore into commits (sha, repo, ts, day, subject, files, insertions, deletions) values (?, ?, ?, ?, ?, ?, ?, ?)`)
const insertTurn = db.prepare(`
  insert or ignore into ai_turns (source_id, ts, day, project, session, prompt, tools) values (?, ?, ?, ?, ?, ?, ?)`)
const insertAgent = db.prepare(`
  insert or ignore into agent_minutes (minute, agent, day, project, events) values (?, ?, ?, ?, ?)`)
const insertEvent = db.prepare(`
  insert or ignore into events (source_id, ts, day, kind, app, detail, meta) values (?, ?, ?, ?, ?, ?, null)`)
const insertTyping = db.prepare(`
  insert or ignore into typing (source_id, ts, day, app, chars, text) values (?, ?, ?, ?, ?, '')`)
const insertDay = db.prepare(`
  insert or replace into days (day, active_seconds, idle_seconds, focus_ratio, switches, first_at, last_at, top_app, stats, narrative, recap, built_at)
  values (?, ?, ?, ?, ?, ?, ?, ?, '{}', ?, ?, ?)`)

for (const w of WINDOWS) {
  insertLabel.run(labelKey({ app: w.app, title: w.title, host: w.host ?? null }), w.app, w.title,
    w.category, w.project, w.category === 'code' || w.category === 'writing' ? 0.8 : 0.4, 0.9, Date.now() / 1000)
}

const COMMITS: Record<string, string[]> = {
  harbor: [
    'HAR-142: Paginate the orders endpoint by cursor', 'HAR-142: Return 404 instead of an empty page', 'HAR-151: Index orders by customer and date',
    'HAR-142: Cap the page size at 200', 'HAR-142: Test the last page of a cursor', 'HAR-151: Log slow queries over 300ms', 'HAR-155: Retry the webhook twice before failing',
  ],
  atlas: [
    'ATL-88: Move the coupon field above the total', 'ATL-90: Show the shipping estimate before payment', 'ATL-88: Keep the cart when the session expires',
    'ATL-88: Tighten the checkout spacing on small screens', 'ATL-90: Load card brands lazily', 'ATL-93: Announce payment errors to screen readers',
  ],
}
const PROMPTS: Record<string, string[]> = {
  harbor: [
    'HAR-142: add cursor pagination to GET /orders and keep the old offset param working for a release',
    'why does this query plan do a sequential scan on orders',
    'write a test for the last page when the cursor points past the end',
  ],
  atlas: [
    'ATL-88: the checkout total jumps when the coupon applies — find where the layout shifts',
    'make the payment error message readable by VoiceOver',
    'split Checkout.tsx into smaller components without changing behaviour',
  ],
}
const SHORTCUTS = ['⌘C', '⌘V', '⌘S', '⌘Z', '⌘T', '⌘W', '⌘⇧P', '⌘P', '⌘F', '⌘Tab', '⌘K', '⌘Return']

const today = dayOf(Date.now() / 1000)
const toTs = (day: string, hour: number, minute = 0) =>
  Math.floor(new Date(`${day}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`).getTime() / 1000)
const addDays = (day: string, n: number) =>
  new Date(Date.parse(`${day}T12:00:00`) + n * 86_400_000).toISOString().slice(0, 10)

let blocks = 0
for (let back = 20; back >= 0; back--) {
  const day = addDays(today, -back)
  const weekday = new Date(`${day}T12:00:00`).getDay()
  // The last day is always a full working day, whatever the calendar says: it
  // is the one the Today screen shows, and a quiet Sunday there shows nothing.
  const weekend = back > 0 && (weekday === 0 || weekday === 6)
  // Most weekends are off; one of them has an hour of tinkering.
  if (weekend && random() > 0.35) continue

  const start = weekend ? between(10, 11) : between(8.6, 9.5)
  const end = weekend ? start + between(1, 2.2) : between(17.5, 19)
  let t = toTs(day, Math.floor(start), Math.floor((start % 1) * 60))
  const stop = toTs(day, Math.floor(end), Math.floor((end % 1) * 60))
  let firstAt = t
  let active = 0
  let idle = 0
  let switches = 0
  let lunchDone = false

  while (t < stop) {
    const hour = new Date(t * 1000).getHours()
    // Lunch, and the odd coffee: time away, which the app shows as away.
    if (!lunchDone && hour >= 12 && hour < 14 && !weekend) {
      const away = Math.floor(between(35, 60) * 60)
      insertBlock.run(t, t + away, away, day, null, null, null, null, null, 1, 0, 0, 0, 0, null, 0, null, null)
      idle += away; t += away; lunchDone = true; continue
    }
    const w = windowFor(hour)
    // A focused stretch in the editor runs long; a glance at Slack does not.
    const minutes = w.category === 'code' ? between(10, 34)
      : w.category === 'ai' ? between(6, 22)
      : w.category === 'communication' ? between(3, 14)
      : between(4, 18)
    const seconds = Math.floor(minutes * 60)
    const inCall = w.app === 'zoom.us'
    const keys = Math.floor(seconds * w.writing * between(0.8, 1.6))
    const scroll = Math.floor(seconds * (1 - w.writing) * between(0.2, 0.6))
    const clicks = Math.floor(seconds * between(0.05, 0.18))
    const music = !inCall && w.category === 'code' && random() < 0.35
    insertBlock.run(t, t + seconds, seconds, day, w.app, w.bundle, w.title, w.url ?? null, w.host ?? null, 0,
      keys, clicks, scroll, inCall ? 1 : 0, random() < 0.8 ? DISPLAY : LAPTOP,
      music ? 1 : 0, music ? 'Spotify' : null, music ? pick(['Nils Frahm — Says', 'Tycho — Awake', 'Bonobo — Kerala']) : null)
    blocks++
    if (w.url) insertVisit.run(t + 5, day, w.url, w.host, w.title)
    for (let s = 0; s < Math.floor(seconds / 240); s++) {
      insertEvent.run(`demo-ev-${t}-${s}`, t + s * 240, day, 'shortcut', w.app, pick(SHORTCUTS))
    }
    if (keys > 400) insertTyping.run(`demo-ty-${t}`, t + 30, day, w.app, Math.floor(keys * 0.9))
    active += seconds; switches++; t += seconds
    // Nobody codes for four hours straight. Between stretches there is Slack,
    // mail, a quick look at something — which is what breaks a day into the
    // 25-to-90-minute sessions a real one has, instead of one long block.
    if (w.category === 'code' || w.category === 'ai') {
      if (random() < 0.55) {
        const glance = pick(WINDOWS.filter((x) => x.category === 'communication' && x.app !== 'zoom.us'))
        const g = Math.floor(between(2, 7) * 60)
        insertBlock.run(t, t + g, g, day, glance.app, glance.bundle, glance.title, glance.url ?? null, glance.host ?? null, 0,
          Math.floor(g * 0.4), Math.floor(g * 0.1), Math.floor(g * 0.3), 0, DISPLAY, 0, null, null)
        active += g; switches++; t += g; blocks++
      }
    }
    // A meeting or two, most days, with the microphone open.
    if (!weekend && random() < 0.07 && hour >= 10 && hour < 17) {
      const zoom = WINDOWS.find((x) => x.app === 'zoom.us')!
      const m = Math.floor(between(25, 50) * 60)
      insertBlock.run(t, t + m, m, day, zoom.app, zoom.bundle, zoom.title, null, null, 0,
        Math.floor(m * 0.02), Math.floor(m * 0.03), 0, 1, DISPLAY, 1, null, null)
      active += m; switches++; t += m; blocks++
    }
    // A short break between stretches.
    if (random() < 0.25) { const gap = Math.floor(between(3, 9) * 60); idle += gap; t += gap }
  }

  // Commits, prompts and agent minutes follow the work that day.
  if (!weekend) {
    for (const project of ['harbor', 'atlas']) {
      const count = Math.floor(between(1, 5))
      for (let c = 0; c < count; c++) {
        const ts = Math.floor(between(firstAt, stop))
        insertCommit.run(`demo${ts}${project}`, project, ts, day, pick(COMMITS[project]),
          Math.floor(between(1, 7)), Math.floor(between(8, 160)), Math.floor(between(2, 60)))
      }
      for (let p = 0; p < Math.floor(between(2, 6)); p++) {
        const ts = Math.floor(between(firstAt, stop))
        insertTurn.run(`demo-turn-${ts}-${project}`, ts, day, project, `demo-${day}-${project}`,
          pick(PROMPTS[project]), JSON.stringify(['Read', 'Edit', 'Bash']))
      }
    }
    // An agent keeps working through lunch — the delegated time the app counts
    // as work, not as absence.
    const lunch = toTs(day, 12, 30)
    for (let m = 0; m < Math.floor(between(25, 50)); m++) {
      insertAgent.run(Math.floor(lunch / 60) + m, 'claude', day, 'harbor', Math.floor(between(1, 6)))
    }
    for (let m = 0; m < Math.floor(between(20, 60)); m++) {
      const minute = Math.floor(between(firstAt, stop) / 60)
      insertAgent.run(minute, pick(['claude', 'codex']), day, pick(['harbor', 'atlas']), Math.floor(between(1, 5)))
    }
  }

  // Past days carry the journal the app would have written for them.
  if (back > 0 && !weekend) {
    const focus = between(0.48, 0.71)
    insertDay.run(day, active, idle, focus, switches, firstAt, stop, 'Code',
      `- ${Math.round(active / 3600 * 10) / 10}h active, ${Math.round(focus * 100)}% of it in code, AI and writing.\n` +
      `- The longest stretch was in harbor, on cursor pagination for the orders endpoint.\n` +
      `- An agent kept working through lunch: about 40 minutes of delegated work.\n` +
      `- ${switches} app switches; most of them between the editor, the terminal and Claude.`,
      `A day that belonged to harbor. Pagination went in before lunch, the agent finished the tests while you were out, and the afternoon went to review and a couple of messages in #harbor-dev.`,
      stop + 3600)
  }
}

// The branches each repository sat on. They are what ties a question or an
// agent's minutes that name no ticket to the ticket the work was for.
const insertBranch = db.prepare(`insert or ignore into branches (repo, ts, day, branch, from_branch) values (?, ?, ?, ?, ?)`)
for (const [repo, back, branch, from] of [
  ['harbor', 20, 'feature/har-142-cursor-pagination', 'main'],
  ['harbor', 9, 'feature/har-151-slow-queries', 'feature/har-142-cursor-pagination'],
  ['harbor', 3, 'feature/har-155-webhook-retries', 'main'],
  ['atlas', 20, 'feature/atl-88-coupon-layout', 'main'],
  ['atlas', 6, 'feature/atl-93-voiceover-errors', 'feature/atl-88-coupon-layout'],
  ['ledger', 20, 'feature/glx-17-reconcile', 'main'],
] as const) {
  const ts = toTs(addDays(today, -back), 8, 40)
  insertBranch.run(repo, ts, dayOf(ts), branch, from)
}

// A second client, smaller: a few hours a week on globex's ledger. Drawn from
// a seed of its own, so the days above come out exactly as they always have.
seed = 777
for (let back = 20; back >= 0; back--) {
  const day = addDays(today, -back)
  const weekday = new Date(`${day}T12:00:00`).getDay()
  if (weekday === 0 || weekday === 6 || random() < 0.4) continue
  for (let c = 0; c < Math.floor(between(1, 3)); c++) {
    const ts = toTs(day, Math.floor(between(15, 18)), Math.floor(between(0, 59)))
    insertCommit.run(`demo${ts}ledger`, 'ledger', ts, day,
      pick(['GLX-17: Round at the ledger, not at the line', 'GLX-17: Reconcile in integer cents', 'GLX-21: Export the month as CSV']),
      Math.floor(between(1, 4)), Math.floor(between(6, 80)), Math.floor(between(1, 30)))
  }
  insertTurn.run(`demo-turn-ledger-${day}`, toTs(day, 16, 10), day, 'ledger', `demo-${day}-ledger`,
    'GLX-17: find where a cent is lost between the invoice lines and the ledger total', JSON.stringify(['Read', 'Grep']))
  insertVisit.run(toTs(day, 16, 5), day, 'https://globex.atlassian.net/wiki/spaces/OPS/pages/77/Ledger+runbook', 'globex.atlassian.net', 'Ledger runbook - Operations - Confluence')
  insertVisit.run(toTs(day, 16, 20), day, 'https://globex.atlassian.net/browse/GLX-21', 'globex.atlassian.net', '[GLX-21] Monthly CSV export - Jira')
}

// The tickets behind acme's branches, opened now and then: it is the history
// that gives each one its title.
const TICKETS: [string, string, number, number][] = [
  ['HAR-151', 'Slow queries on the orders list', 9, 4],
  ['HAR-155', 'Webhook deliveries fail on the first timeout', 3, 0],
  ['ATL-88', 'Coupon field shifts the total while typing', 20, 7],
  ['ATL-90', 'Shipping estimate before payment', 16, 10],
  ['ATL-93', 'Payment errors are silent to screen readers', 6, 0],
]
for (const [key, title, fromBack, toBack] of TICKETS) {
  for (let back = fromBack; back >= toBack; back--) {
    const day = addDays(today, -back)
    const weekday = new Date(`${day}T12:00:00`).getDay()
    if (weekday === 0 || weekday === 6) continue
    insertVisit.run(toTs(day, 9, 15), day, `https://acme.atlassian.net/browse/${key}`, 'acme.atlassian.net', `[${key}] ${title} - Jira`)
  }
}

// The settings the screenshots are taken with.
setMeta('settings', JSON.stringify({
  language: 'en-US', name: 'Alex', vault: '', journalFolder: 'Journal', dayStartHour: 4,
  keepTyping: true, voice: 'onyx', shortcut: 'CommandOrControl+Shift+Space', voiceMode: 'push',
  liveVoice: 'marin', region: 'global', caption: true, wideTools: false,
}))

console.log(`demo data: ${blocks} windows over three weeks, ending ${today}, in ${target}`)
