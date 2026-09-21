# Changelog

What changed, for someone using the app — not a list of commits. One line per
change, written in the terms a person would notice it in. The rules for when a
release is cut are in `CLAUDE.md`, under "CI and releases".

## Unreleased

- The same question about your day gets the same number, with the wider tools on
  too: the assistant is told to use the app's own tools, never its own SQL.
- Commits are counted once, even after a rebase or a rewritten history. One
  day here had counted 165 where there were 88.
- The assistant knows the piece of work, not only the app: "how much went to
  this client", "what have I done on SUP-123" are answered from the ticket, the
  page, the pull request and the client behind each tab, joined with the
  commits and questions that name them.
- A second program writing to the database waits its turn instead of failing.
- The day starts when you sat down, even if the app was closed: macOS's own
  record of keys and pointer marks each stretch at the machine.
- Work on a branch counts for the ticket in its name. Commits, questions to the
  agent, the agent's own minutes and editor time on feature/sup-12-login all
  land on SUP-12, even when nothing in them says so.
- Questions to an agent are only what you typed. Background tasks announcing
  themselves, /model's output and plugin lists had been counted as requests —
  one in six here.
- A Work tab: time and moments by client and by piece of work — tickets,
  Confluence pages, pull requests, documents, videos — and everything that
  touched one of them, in order, a click away. It shows only what your data
  has: no clients box for someone who has no clients.
- The Rhythm shows where the keys went, per app, and what kind of writing
  the typed text was — requests to AI, chats, code — without reading it.

## v0.1.0 — 2026-09-21

The first release. Everything below runs on the Mac it measures; nothing about
the day leaves it unless the wider tools are switched on.

**Measuring**

- Which app and window is in front, every four seconds, and when you step away.
- Keys, clicks and scroll as counts, which is what separates writing from
  reading. What you type is kept too, with secrets redacted, and that can be
  switched off.
- The screen a window is on, what is playing, and when the microphone is open
  for a call.
- Commits, Claude Code and Codex sessions, shell history and browser history,
  harvested in the background.
- Time an agent spent working while you were away counts as delegated work,
  not as idleness.

**Reading it back**

- Today: time, focus, the ribbon of the day, where the time went, the hands.
- Rhythm: 7, 30 or 90 days, and an hour × weekday map. Clicking a cell narrows
  the charts under it to that slot; a weekday's name narrows to the whole day.
- Journal: a daily summary and recap, written into your Obsidian vault.
- Every window is classified into a category and a project by jev, through the
  day rather than only when it closes. An uncertain answer stays "unlabelled"
  instead of being guessed, and is asked again later.

**Talking to it**

- A conversation with Claude Code, with the local database as its tools.
  Answers render links, tables, lists and code.
- Voice two ways: press and speak, or a live session with GPT-Live-1 that you
  can interrupt. Both think with Claude Code; the voice never answers alone.
- A floating core summoned by the wake word or a shortcut you choose, which
  can be dismissed with the same shortcut or Esc and shows whether it is
  connected.
- Optional wider tools: files, commands, the web and the MCP servers already
  configured on the machine. Off until switched on.

**Around it**

- Five languages: Portuguese, English, Spanish, French and German.
- Settings inside the app. Keys live in the macOS Keychain, never in a file.
- The OpenAI region is chosen in Settings, for keys that belong to a European
  project.
- Signed with a Developer ID; the collector, the focus helper and the listener
  are login items you can see in System Settings.

**Known**

- Not notarized yet, so macOS blocks it on a Mac other than the one that built
  it. There is no download attached to this release: build it from source with
  `npm run dist`.
