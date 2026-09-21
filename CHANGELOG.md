# Changelog

What changed, for someone using the app — not a list of commits. One line per
change, written in the terms a person would notice it in. The rules for when a
release is cut are in `CLAUDE.md`, under "CI and releases".

## Unreleased

- Today says what your typing was — a prompt, a message, code — which until now
  only the month could tell you.
- The ranges in Work no longer squeeze: "7 days" stopped breaking over two
  lines when the subtitle was long, and a client called "acme" is no longer
  drawn as "a…".
- The section in the vault keeps its heading above the markers, so other tools
  that read a note by its headings — an Obsidian plugin, a script — no longer
  write inside our block and lose what they wrote. Notes written the old way
  are converted the next time the day is written.
- A day's note nobody has written yet is created from the vault's own daily
  template, with the properties and headings the other notes have.
- Closing a day by hand uses your settings: the journal folder and the
  language, instead of defaults of its own.
- Delegated work counts every minute an agent worked, not only the minutes you
  were away: a morning of an agent working beside you had read "1min". The
  time with you away is still said, underneath. An agent's minutes now run
  from the question to the answer, the minutes a tool was running included —
  one session here went from 30 counted minutes to 68.
- The app's own sessions — writing the journal, answering in the chat — are
  no longer counted as your agents at work or as your requests.
- A first-run walkthrough: what stays on the Mac and what each optional
  service sees, the two macOS permissions with their live state, where your
  code lives, the Obsidian vault, the services with their keys, and the two
  extras. Every step can be skipped, and Settings can bring it back.
- The folder your repositories live in is a setting, no longer fixed at
  ~/Documents/GitHub.
- Well-known apps get their category on the Mac itself — an editor is code,
  Slack is communication — so the day's focus is not empty without a
  TypeSafe key. Anything uncertain is still left unlabelled.
- The Work tab can show just today.
- The sidebar says in words why a source is not collecting — "waiting for you
  to allow it" — instead of an internal code, and no longer lists the sources
  that were simply never tried.
- The menu bar icon shows in the installed app. Since the first release it had
  been an empty space you could click but not see.
- The app no longer says that nothing leaves the Mac. The database stays on it;
  answering and writing up the day go through Claude Code and jev with what they
  need, and the chat and Settings now say so.

## v0.2.0 — 2026-09-21

From which app to which piece of work. Everything below still runs on the Mac
it measures.

- The line that opens each day in the journal is written in one language again;
  the rename had left it half in English.
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
- A call with the camera on is told apart from an audio one. The camera is
  asked only whether it is running, the way the microphone already was; no
  frame is read and no permission is needed.
- Calendar meetings, off until you turn them on in Settings: their names and
  times appear on the day beside how much of each had a microphone open.
  macOS asks for access once, when you turn it on; turning it off deletes
  what came.
- A timesheet draft, off until you turn it on: the week's measured focus by
  client and by ticket, space or project, with the agent's time apart and the
  time with no client stated. In the Work tab, in the conversation, and on
  Fridays in the journal.

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
