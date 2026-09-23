# Hippocampus

Your Mac already knows where your time went. Hippocampus keeps it — **all local,
every day** — and gives it back as charts, as a journal, and as a conversation.

*[Leia em português](README.pt-BR.md).*

**[Download for Mac](https://github.com/rodolfobortolin/hippocampus/releases/latest/download/Hippocampus-arm64.dmg)**
— macOS 13 or later, Apple silicon. Signed and notarized; it updates itself.

```
native helper (Swift)  ─┐
browsers, git, shell    ├─►  collector (launchd, always up)  ─►  local SQLite
Claude Code sessions   ─┤                                             │
Computer History       ─┘                                             ▼
                                           jev classifies ─► Claude Code narrates
                                                                      │
                                             app (Electron) ◄─────────┘
                                                      │
                                             Obsidian vault
```

The database lives on this machine and nowhere else. What leaves it goes under
your own keys and login: jev gets window titles, to label them; Claude Code gets
the day — its figures, the sites, what you asked your agents and, when Codex's
Computer History is on, a few lines of what you typed — and, when you ask it to
look, a picture of your screen; OpenAI gets your voice, only while you talk to
it; and Groq, if you turn on the fast hands, gets the names of the controls in
the window it is acting on. The keys are yours and live in the macOS Keychain, entered inside the app
itself. With no keys at all it still measures, draws and stores: only the
classification, the narrative and the chat go dark.

## Text and events

Hippocampus measures from what is already text: the focused window title, the
tab URL, the commands, the commits, what you asked Claude Code. It runs on a
native helper costing a few milliseconds per sample.

There is also no server, no account and no admin dashboard. There is nothing an
employer could log into to look at your day: the most common fear in this
category is impossible here by construction, not by policy.

## The tone

The journal is written like a `git log`: a record of what happened, not a
verdict on the person. No praise, no scolding, no score, no implied target.

This is a product decision, not a style. The number-one cause of abandonment in
time trackers is **guilt**: measurement reveals that nobody does eight focused
hours — they do two to five — and almost every app treats that as failure. A
short day, a fragmented day and a day full of meetings are facts about the
world. And when the collector was down, the text says measurement is missing,
instead of letting it look like a day when you did nothing.

## Getting started

Download the `.dmg` above, drag Hippocampus to `/Applications`, open it, and turn
on **measure on its own** in Settings. That registers three login items — the
collector, the window reader and the wake-word listener — which macOS then asks
you to approve in **Settings → General → Login Items**. They start with the Mac
and come back if they fall.

To build it yourself:

```bash
npm install
npm run build:native      # builds the Swift helpers
npm run dist              # builds and signs Hippocampus.app into release/
```

To work on it, without packaging:

```bash
npm run dev:app           # core, interface and window, from source
npm run install:agent     # the old hand-installed launchd agents
npm test
```

Requirements: macOS 13+, Node 24+, Xcode command line tools, and `claude`
installed and signed in for the written part. The packaged app does not need
Node at all — it runs the core on the Electron it already ships.

**Keep the app out of `~/Documents`.** macOS protects that folder, and a
background agent that cannot read it does not fail — it hangs, before writing a
single line of log. `/Applications` is not protected, which is half the reason
the app is packaged at all.

Then open **Settings** inside the app: pick your language, tell it what to call
you, point it at your Obsidian vault, and paste the keys. Nothing there touches
a text file — see [Keys](#keys).

## Five languages, all the way down

Portuguese, English, Spanish, French and German. The choice applies to
everything, not just the buttons: the interface, the dates and numbers, the
journal Claude Code writes, the chat, the voice, and the questions jev is asked
when it classifies a window. An app that measures your day and then writes
about it in someone else's language is of no use to you.

Category keys (`code`, `ai`, `distraction`…) are identifiers stored in the
database and never change — switching language cannot rewrite the past. Only
what you read changes.

## Keys

Three keys, all optional, all kept in the **macOS Keychain** and entered in the
app's own Settings screen. They never touch a config file and never appear in a
commit. When you type one in, it travels to the Keychain through standard input
rather than a command argument — process arguments are readable by any `ps` on
the machine.

| Key | What it unlocks | Without it |
| --- | --- | --- |
| **jev (TypeSafe)** | category, project and focus per window | time per app still works; nothing is grouped by subject |
| **OpenAI** | transcribing what you say, speaking answers, and the live voice | the system voice reads answers and there is no live voice; the chat is unaffected |
| **Groq** | the fast hands: on-screen actions in seconds | on-screen actions go through Claude Code, which takes several seconds a step |

The chat is always Claude Code, through the `claude` login already on the
machine — no API key, no new account, no cost beyond the subscription you
already pay.

A `.env` still works for development, but the Keychain wins: what you type in
the app is what counts.

## The permissions

macOS protects exactly what matters here. The first prompts appear on first run
— and until they are answered, that source is marked *waiting for you to allow
it* in the sidebar, without blocking the rest. The last two only appear the
first time you ask it to look at your screen or to click on it.

| Permission | Asked for by | What it unlocks | Without it |
| --- | --- | --- | --- |
| **Accessibility** | Hippocampus Focus | window title and tab URL | you see *which app*, not *what* you were working on |
| **Access to other apps' data** | Hippocampus | Chrome/Arc history and Computer History | loses visited sites and the fine-grained keyboard events |
| **Microphone and Speech Recognition** | Hippocampus Listener | the wake word, recognised on-device | no wake word; the shortcut and a click still work |
| **Calendars** — only if you turn it on | Hippocampus | meeting names and times | calls stay "microphone open", unnamed |
| **Screen Recording** — only when asked | Hippocampus | looking at your screen when you ask | it tells you the permission is missing |
| **Accessibility** — only when asked | Hippocampus | clicking on your screen when you ask | it tells you the permission is missing, and does not click |

```bash
npm run permission
```

**Authorize through the dialog, not by flipping the switch by hand.** They look
like the same thing and are not: the dialog records the code requirement
alongside the permission, and the switch alone leaves macOS denying internally
while showing it enabled on screen.

The helper has its own `launchd` agent on purpose. macOS does not attribute the
permission to whoever asks, but to the **responsible process** — whoever
launched it. Were the Node collector to launch it, `node` is what would show up
in the list, and authorizing `node` would grant Accessibility to every Node
script on the machine. Launched directly by `launchd`, it answers for itself and
appears as "Hippocampus Focus".

The build uses the **Developer ID** from the keychain when one exists, and this
is not about distribution: the grant is bound to the certificate identity, which
does not change between builds. With an ad-hoc signature it is bound to the code
hash, and then every `npm run build:native` drops the permission **silently** —
the switch stays on screen while the system denies underneath. With no Developer
ID in the keychain the build says so and falls back to ad hoc; `npm run
permission` re-grants when that happens.

## What it collects

| Source | What it becomes | How often |
| --- | --- | --- |
| Native Swift helper | focused app, window title, tab URL, idleness | every 4s |
| Computer History (Codex) | shortcuts, window switches, clicks, what you typed | every 2min |
| Chrome · Arc · Brave · Edge · Safari | visited sites | every 10min |
| Claude Code and Codex sessions | what you asked and which tools ran | every 10min |
| `~/.zsh_history` | commands | every 15min |
| Repositories in your code folder (`~/Documents/GitHub` unless you pick another) | commits, lines added and cut, and each branch switch from the reflog | every 30min |
| The macOS power log (`pmset`) | when you sat down and when you left, even with the app closed | every hour |
| macOS Calendar — off until you turn it on | meeting names and times, from yesterday to tomorrow | every 10min |

Time becomes a **block**: a continuous stretch in the same app and the same
window. The block is written when it starts and extended on every sample, so a
crash costs at most one sample. Past two minutes idle it becomes an idle block,
which does not count as active time.

Every block also carries **keys, clicks and scroll** — the system counters,
which cost no permission at all — and whether a **microphone or camera was in
use**. The first separates reading from writing; the second detects a call, and
a video call, without having to recognise Zoom, Teams or Meet by process name.
Neither reads a sound or a frame: the system is only asked whether the device
is running.

Agent logs record as "user" a good deal no one typed — background tasks
announcing themselves, the output of `/model`, plugin lists. Only what a person
wrote is kept as a request; the words inside a voice delegation or after an
attached image are kept too.

Contiguous blocks of the same project become an **episode**, which is the unit
you can actually search. Four seconds in Chrome match no question at all, but
"forty minutes in atende, with these commits and these commands" does. Episodes
are indexed in FTS5, and that is what answers *"where did I leave off on X"*.

## What it measures

**Focused work** is time in the code, AI, writing, design and research
categories — a real fraction of time, not the average of a probability. A
**focus session** is the stretch where that held: a 15-minute sliding window
requiring 75%, tolerating breaks of up to 2 minutes. It is the difference
between four focused hours in two sessions and the same four hours cut into ten
— which every daily total shows identically.

**App switches** come split apart: the one that changes project costs attention
residue, the one that does not is the work itself.

**Delegated work** is counted separately. This machine works with agents: time
away from the keyboard while an agent is producing is not idleness, and the
journal is told to say so.

The thresholds are a convention, and what matters is that they stay frozen: the
number is for comparing you with you, never with another person or another app.

Computer History is a cache that OpenAI itself deletes within hours. Hippocampus
harvests it before it disappears and archives it compressed in `archive/` —
which is how it can reconstruct days from before it was installed
(`npx tsx core/backfill.ts`).

## Pieces of work

The app knows which app you were in; the identifiers that cross between sources
say what you were working on. A tab's address is read into a piece of work —
a Jira ticket, a Confluence page, a pull request, a document, a video — and
whose it is: the Jira or Confluence subdomain, the GitHub owner. The same
ticket key in a tab, a question to Claude Code and a commit message becomes one
line. The branch a repository sat on joins in what names nothing: a commit, a
question, the agent's minutes or a stretch in the editor on
`feature/sup-12-login` count for SUP-12.

The **Work** tab shows it by client and by piece, with every moment that
touched one of them a click away. It shows only the axis your data has: someone
with no clients sees no clients box. Email is "email", never its subject.

For whoever bills by the hour there is a **timesheet draft**, off until you
turn it on: the week's measured focus by client and line, the agent's time
apart, and the time with no client stated plainly. It is a record to check,
never a judgement — for anyone who does not bill by the hour a timesheet reads
as surveillance, which is why it is not on by default.

## The conversation

The Chat tab and the floating core answer from the local database, through
Claude Code and a dozen tools over what was measured — never from memory, and
never with hand-written SQL, so a number means the same thing everywhere. Ask
by typing or out loud.

- **Press and speak** records one question, transcribes it and reads the answer
  back. **Live** keeps a conversation open that you can interrupt, and bills for
  the time it stays open; a line over the text box says when it is connecting,
  when it is live and for how long, what you say appears as you say it, and the
  sphere moves with your voice as well as with its own.
- **Ask it to look at your screen** and it does, at that moment: the display
  under the cursor, or all of them if you say so, with Hippocampus's own windows
  left out. The picture is used for that answer and deleted.
- When the answer is a place on the screen, a spark of the core **flies there
  and names it**. Ask it to **click** and it does, after the pointer lands where
  you can see it — and it will not send, buy, delete or confirm anything unless
  that is exactly what you asked for.
- **Fast hands**, off by default and with a Groq key: jev judges each request,
  and an action on the screen — open this, press that, read the result — is
  done by a fast model on Groq in about a second a step, reading the window's
  controls through Accessibility rather than from a picture. Anything else, and
  anything the hands cannot finish, goes to Claude Code.
- **Wider tools**, off by default, hand it the rest of Claude Code on this Mac:
  files, commands, the web, your MCP servers — typed or spoken, without asking
  first.

## The core, on call

The floating core is the app when you do not want the app: a frameless window
with just the sphere, above whatever you are doing. It listens with a click and
answers out loud.

- Say **"Hippocampus"** and it comes to the front, already listening — in live
  mode, with the conversation open. The wake word is recognised entirely
  on-device by `SFSpeechRecognizer`: no audio leaves the machine, and nothing
  is recorded until you speak to it. At rest the sphere stirs faintly with the
  sound of the room, which is how you can tell the listener is alive.
- **⌘⇧Space** does the same without the word. **⌘⇧H** shows and hides it.
- Drag the sphere to move it; where you leave it is where it comes back.
- Click it to stop it talking, or to ask something else.

## Signed, and notarized when you want to share it

The build picks up a **Developer ID** certificate from the keychain when one is
there, and turns on the hardened runtime and least-privilege entitlements. On
your own machine that is enough — and it is what makes the Accessibility grant
survive a rebuild, because it binds to the certificate identity rather than to
the code hash.

Notarization only matters when someone else downloads it: Gatekeeper refuses, on
first open, a Developer ID app Apple has never seen. Store a credential once and
one command does the rest:

```bash
xcrun notarytool store-credentials hippocampus --apple-id YOU@EXAMPLE.COM --team-id YOURTEAM
npm run notarize
```

Without `--password` the password is asked for without echoing, so it never
lands in your shell's history. `npm run notarize` leaves three files in
`release/vX.Y.Z/`: the `.dmg` to download, and the zip and `latest-mac.yml`
that installed copies update from — the app looks for a new release on GitHub
when it opens and every four hours, and installs it on restart.

The app-specific password is generated at appleid.apple.com — it is not your
Apple ID password, and it lives in the Keychain, never in the repository.

## The closed day

When the date turns (at 4am, so the small hours count as the day before), the
collector closes the day: classifies with jev, computes the numbers, asks Claude
Code for the text and writes it into `YYYY-MM-DD.md` in your vault, inside its
own markers — whatever else wrote in that same note stays intact. The vault
folder and the journal subfolder are both set in Settings.

Then it reads the day once more, for what outlives it. The prompts you wrote
that day go to Claude Code, which answers with the few things worth keeping —
a project that moved, a problem understood, what someone is waiting for — and
each one is written into your own notes: `20 Projects`, `40 Knowledge`,
`50 People`, `30 Areas`, `00 Inbox`, or whatever those folders are already
called in your vault, in any of the five languages. A note that exists gets one
more line in the section it already has; a note that does not is born from your
vault's template. Most days keep one thing or none, a day already read is never
read twice, and the switch in Settings turns the whole thing off. The Notes tab
shows what was kept and takes anything you want to write yourself.

If the machine was asleep at the turn, the day joins a queue and is closed on
the next boot. By hand:

```bash
npm run rollup -- 2026-09-19
npm run rollup -- 2026-09-19 --no-narrative   # numbers only
```

## Where the data lives

```
~/Library/Application Support/Hippocampus/
  hippocampus.db          everything measured
  archive/              Computer History events, compressed
~/Library/Logs/Hippocampus/
  collector.log         the core
  listener.log          the wake word
```

To leave without a trace: `npm run uninstall:agent` and delete that folder. To
stop storing what you type, turn it off in Settings — what is already stored
went through secret redaction before being written.

## Structure

```
native/focus.swift     helper sampling focus, window, URL, idleness, microphone
                       and camera — and the calendar, when asked for
native/listener.swift  the wake word, recognised on-device, and the room's loudness
native/screen.swift    a picture of the screen without the app in it, and a click
native/agents.swift    registers the helpers as login items
core/
  collector.ts         the loop: sample, harvest, close the day
  db.ts                SQLite schema and its migrations
  sources/             focus, Computer History, browsers, Claude Code, Codex,
                       git and its reflog, shell, the power log, the calendar
  pages.ts             a URL read into a piece of work, and whose it is
  items.ts             pieces of work gathered across every source
  timesheet.ts         the optional weekly draft by client and line
  prompts.ts           what a person typed, out of an agent's log
  jev.ts               per-window classification, memoised
  metrics.ts           the day and the period, in numbers
  rollup.ts            closes the day and asks for the narrative
  agent.ts             the chat, with tools over the database and the screen
  live.ts              the live voice, which hands every question to Claude Code
  screen.ts            looking, pointing and clicking, on request
  server.ts            local API on 127.0.0.1
  settings.ts          settings, and the keys in the Keychain
  languages.ts         the five languages, for everything the core writes
  guard.ts             no single source may stall the collector
app/main.cjs           the window, the tray icon, the floating core and the pointer
app/pointer.html       the spark that flies to a place on the screen
src/                   the interface (React + hand-written SVG)
site/                  the project's website
```

## A note on the language of the code

The interface speaks five languages. The source speaks one: identifiers and
comments are in English, and the comments explain *why* — nearly every one in
`native/` and `app/main.cjs` exists because macOS punished a reasonable idea.
Pull requests in Portuguese or English are welcome.

## License

MIT.
