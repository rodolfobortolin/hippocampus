# Hipocampo

Your Mac already knows where your time went. Hipocampo keeps it — **all local,
every day** — and gives it back as charts, as a journal, and as a conversation.

*[Leia em português](README.pt-BR.md).*

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

Nothing leaves this machine. The keys are yours and live in the macOS Keychain,
entered inside the app itself. With no keys at all it still measures, draws and
stores: only the classification, the narrative and the chat go dark.

## Text and events, not pixels

Almost every app in this category records the screen and sends it to a vision
model. That is why they cost so much (a popular competitor burns roughly ten
dollars in a working day, at about a million input tokens per hour), drain the
battery, light up the orange screen-sharing dot, and cannot be sold in the EU.

Hipocampo never takes a single screenshot. It reads what is already text: the
focused window title, the tab URL, the commands, the commits, what you asked
Claude Code. It comes out two orders of magnitude cheaper, runs on a native
helper costing a few milliseconds per sample — and "I have never taken a
screenshot" is a sentence the others cannot say.

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

```bash
npm install
npm run build:native      # builds the helper that reads window focus
npm run install:agent     # collector starts at login and comes back on its own
npm run dev:app           # the window
```

Requirements: macOS, Node 22+, Xcode command line tools (for the helper), and
`claude` installed and signed in for the written part.

Then open **Settings** inside the app: pick your language, tell it what to call
you, point it at your Obsidian vault, and paste the keys. Nothing there touches
a text file — see [Keys](#keys).

## Five languages, all the way down

Portuguese, English, Spanish, French and German. The choice applies to
everything, not just the buttons: the interface, the dates and numbers, the
journal Claude Code writes, the chat, the voice, and the questions jev is asked
when it classifies a window. An app that measures your day and then writes
about it in someone else's language is of no use to you.

Category keys (`codigo`, `ia`, `distracao`…) are identifiers stored in the
database and never change — switching language cannot rewrite the past. Only
what you read changes.

## Keys

Two keys, both optional, both kept in the **macOS Keychain** and entered in the
app's own Settings screen. They never touch a config file and never appear in a
commit. When you type one in, it travels to the Keychain through standard input
rather than a command argument — process arguments are readable by any `ps` on
the machine.

| Key | What it unlocks | Without it |
| --- | --- | --- |
| **jev (TypeSafe)** | category, project and focus per window | time per app still works; nothing is grouped by subject |
| **OpenAI** | speaking and transcribing | the system voice takes over; the chat is unaffected |

The chat is always Claude Code, through the `claude` login already on the
machine — no API key, no new account, no cost beyond the subscription you
already pay.

A `.env` still works for development, but the Keychain wins: what you type in
the app is what counts.

## The two permissions

macOS protects exactly what matters here. Two prompts appear on first run — and
until they are answered, that source is marked *waiting for you to allow it* in
the sidebar, without blocking the rest.

| Permission | What it unlocks | Without it |
| --- | --- | --- |
| **Accessibility** | window title and tab URL | you see *which app*, not *what* you were working on |
| **Access to other apps' data** | Chrome/Arc history and Computer History | loses visited sites and the fine-grained keyboard events |

```bash
npm run permissao
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
appears as "Hipocampo Focus".

The build uses the **Developer ID** from the keychain when one exists, and this
is not about distribution: the grant is bound to the certificate identity, which
does not change between builds. With an ad-hoc signature it is bound to the code
hash, and then every `npm run build:native` drops the permission **silently** —
the switch stays on screen while the system denies underneath. With no Developer
ID in the keychain the build says so and falls back to ad hoc; `npm run
permissao` re-grants when that happens.

## What it collects

| Source | What it becomes | How often |
| --- | --- | --- |
| Native Swift helper | focused app, window title, tab URL, idleness | every 4s |
| Computer History (Codex) | shortcuts, window switches, clicks, what you typed | every 2min |
| Chrome · Arc · Brave · Edge | visited sites | every 10min |
| Claude Code sessions | what you asked and which tools ran | every 10min |
| `~/.zsh_history` | commands | every 15min |
| Repositories under `~/Documents/GitHub` | commits, lines added and cut | every 30min |

Time becomes a **block**: a continuous stretch in the same app and the same
window. The block is written when it starts and extended on every sample, so a
crash costs at most one sample. Past two minutes idle it becomes an idle block,
which does not count as active time.

Every block also carries **keys, clicks and scroll** — the system counters,
which cost no permission at all — and whether the **microphone was in use**. The
first separates reading from writing; the second detects a call without having
to recognise Zoom, Teams or Meet by process name.

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

Computer History is a cache that OpenAI itself deletes within hours. Hipocampo
harvests it before it disappears and archives it compressed in `archive/` —
which is how it can reconstruct days from before it was installed
(`npx tsx core/backfill.ts`).

## The core, on call

The floating core is the app when you do not want the app: a frameless window
with just the sphere, above whatever you are doing. It listens with a click and
answers out loud.

- Say **"Hipocampo"** and it comes to the front, already listening. The wake
  word is recognised entirely on-device by `SFSpeechRecognizer` — no audio
  leaves the machine, and nothing is recorded until you speak to it.
- **⌘⇧Space** does the same without the word. **⌘⇧H** shows and hides it.
- Drag the sphere to move it; where you leave it is where it comes back.
- Click it to stop it talking, or to ask something else.

## The closed day

When the date turns (at 4am, so the small hours count as the day before), the
collector closes the day: classifies with jev, computes the numbers, asks Claude
Code for the text and writes it into `YYYY-MM-DD.md` in your vault, inside its
own markers — whatever else wrote in that same note stays intact. The vault
folder and the journal subfolder are both set in Settings.

If the machine was asleep at the turn, the day joins a queue and is closed on
the next boot. By hand:

```bash
npm run rollup -- 2026-09-19
npm run rollup -- 2026-09-19 --sem-narrativa   # numbers only
```

## Where the data lives

```
~/Library/Application Support/Hipocampo/
  hipocampo.db          everything measured
  archive/              Computer History events, compressed
~/Library/Logs/Hipocampo/collector.log
```

To leave without a trace: `npm run uninstall:agent` and delete that folder. To
stop storing what you type, turn it off in Settings — what is already stored
went through secret redaction before being written.

## Structure

```
native/focus.swift    helper sampling focus, window, URL and idleness
native/ouvido.swift   the wake word, recognised on-device
core/
  collector.ts        the loop: sample, harvest, close the day
  db.ts               SQLite schema
  sources/            focus, Computer History, browsers, Claude Code, git, shell
  jev.ts              per-window classification, memoised
  rollup.ts           closes the day and asks for the narrative
  agent.ts            the chat, with tools over the database
  server.ts           local API on 127.0.0.1
  ajustes.ts          settings, and the keys in the Keychain
  idiomas.ts          the five languages, for everything the core writes
  limite.ts           no single source may stall the collector
app/main.cjs          the window, the tray icon and the floating core
src/                  the interface (React + hand-written SVG)
```

## A note on the language of the code

The interface speaks five languages. The source does not: identifiers and
comments are in Brazilian Portuguese, because that is the language this was
thought in and the comments explain *why*, which is the part worth keeping
intact. Pull requests in either language are welcome.

## License

MIT.
