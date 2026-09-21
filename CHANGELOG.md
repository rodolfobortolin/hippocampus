# Changelog

What changed, for someone using the app — not a list of commits. One line per
change, written in the terms a person would notice it in. The rules for when a
release is cut are in `CLAUDE.md`, under "CI and releases".

## Unreleased

- The same question about your day gets the same number, with the wider tools on
  too: the assistant is told to use the app's own tools, never its own SQL.
- Commits are counted once, even after a rebase or a rewritten history. One
  day here had counted 165 where there were 88.

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
