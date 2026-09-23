# Changelog

What changed, for someone using the app — not a list of commits. One line per
change, written in the terms a person would notice it in. The rules for when a
release is cut are in `CLAUDE.md`, under "CI and releases".

## Unreleased

- Simple questions in the chat are answered by the quick model again. Since
  20 September every question went to the largest one, whatever it asked.
- Asked to press something on screen — a button, a tab, a row — it now finds
  it by name through Accessibility instead of looking for it in a
  screenshot: about a second a click, where it was several.
- The live voice closes after ten seconds with nobody talking, instead of
  listening on until a minute and a half had passed. It stays open while an
  answer is being worked on; say the word, click the sphere or use the
  shortcut to open it again.
- At rest, the sphere stirs with the sound of the room as the wake-word
  listener hears it — only a loudness number, never audio — so you can see
  the microphone waiting for the word is alive. It is held back on purpose,
  weaker than during a conversation.

## v0.4.0 — 2026-09-23

- In the chat, an answer that looks something up first no longer runs its
  opening note into the answer: each starts a paragraph of its own.
- The Journal list shows as much of each day's summary as the row has room
  for, ending in "…", instead of stopping mid-word.
- The note under "keep what you type" in Settings says that a few lines of it
  go to Claude Code with the day's summary. It only mentioned the redaction.
- Ask the chat or the voice to look at your screen and it does: it takes a
  screenshot at that moment, looks at it and answers. Nothing is kept. It
  needs the Screen Recording permission the first time.
- The live voice shows that it is on: a line over the text box says when it
  is connecting, when it is live and how long the session has been open, and
  what you say appears on screen as you say it.
- When the answer is a place on the screen — "where is the export button" —
  a spark of the core flies there and names it. The screenshot it looks at no
  longer includes Hippocampus's own windows, and only the screen under the
  cursor is sent unless you ask for all of them.
- Ask it to click something on your screen and it does: the pointer flies to
  the place first, then the mouse clicks. It asks for the Accessibility
  permission the first time, and it will not click to send, buy, delete or
  confirm unless that is exactly what you asked for.
- In a live conversation the sphere moves with your voice too, not only with
  its own, so you can see you are being heard.
- The wake word keeps working after a live conversation. Opening the live
  voice changed the microphone under the listener, which then heard nothing
  until it was restarted.
- Saying the wake word brings the floating core up again; since 20 September
  it had stopped answering it.

## v0.3.1 — 2026-09-21

- Automatic updates work. v0.3.0 left out a file the updater needs, so it
  could find a new version and never download it; a copy of 0.3.0 has to
  download this one by hand, once, and updates itself from then on.

## v0.3.0 — 2026-09-21

- Hippocampus stays free and open source, and asks once: the end of Settings
  and of the website offer to buy its author a lunch, through Stripe.
- Stripe keys and private keys pasted into a request are no longer stored, and
  any stored before this are taken out of what is kept. They were read at the
  close of the day and could have reached a model, or a note.
- The app updates itself: it looks for a new release on GitHub when it opens
  and every four hours, downloads it in the background, and installs it when
  it restarts — from the menu bar or Settings, which also shows the version.
- The timesheet draft shows a day or a week, stepped back and forth with
  arrows, instead of three buttons where "previous week" looked like the week
  on screen. Lines under a minute are left out, and a note says how many.
- Where the time went, the projects and what you wrote can be drawn as a pie:
  the toggle is in each panel's heading, and the choice is remembered.
- What came out of your hands lists every request of the day and reaches the
  bottom of its panel, instead of stopping at twelve and 250 pixels.
- The categories under the day's ribbon filter it: pick one and only its
  stretches stay lit, with how long they added up to; the same one again, or
  "show all", brings the whole day back. The panels made of the same windows
  follow it — where the time went, the projects, the windows, the hands — and
  say so in their heading; the donut lights the picked category.
- The app's own window is labelled as looking after the work, instead of
  "unlabelled".

- What you asked your agents counts in full under "what you wrote", dictated
  requests included; it had been reading only what the typing sampler caught.

- A project switch counts leaving one piece of work for another. Going from
  the editor to the assistant and back, on the same work, counted twice; a
  day that read 357 project switches had 67.

- Agent work goes to the repository the agent edited, not to the folder the
  session was opened in: a day spent editing one project from a session
  opened in another no longer credits the wrong one. A session opened in the
  home folder or on the desktop is no project at all, so "Desktop", "GitHub"
  and your user name stop appearing as projects. The last 30 days of Claude
  Code sessions are recounted once.

- The minute a question is asked counts as the agent's, even when the answer
  only starts in the next one.

- The trend in Rhythm says what it is drawing, and lets you change it: active
  time, work delegated to agents, app switches or commits, each per day. Under
  the title, where it is going — "rising 18%, the second half of the period
  runs at 25 switches a day" — measured over the days you actually worked, so
  a fortnight away does not read as a collapse. Each point says its own number
  on hover, over the point itself, with the date under it.

- Notes that outlive the day. At the close of the day the app reads what you
  asked your agents for and writes the few durable things into your own vault
  notes — project, knowledge, person, area, inbox — using the folders your
  vault already has, in any of the five languages, and the template it already
  uses. A note that exists gets one more line in its own section. Most days
  keep one thing or none, and a day is never read twice. It is off until you
  turn it on, in the walkthrough or in Settings.
- A Notes tab, to write one yourself: pick the kind, the title (the ones you
  already have are offered), and see where it will be written before it is.
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
