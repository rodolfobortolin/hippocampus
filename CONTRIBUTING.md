# Contributing

Thanks for looking. A few things are worth knowing before you spend an evening
on this, because some of them are not obvious from the code.

## One rule that is not up for negotiation

**No scoring the person.** The journal is a `git log`: a record of what
happened, not a verdict on who did it. No productivity score, no streak, no
grade, no goal the user did not declare, no comparison with an ideal day. The
number-one cause of abandonment in this category is guilt, and everything here
is shaped around not producing it. If a feature only makes sense as "you did
badly today", it does not belong.

Everything else is open, including disagreeing with how any of it was built.

## What you need to run it

macOS 13+, Node 24+, and Xcode command line tools for the Swift helpers. There
is no way around the Mac: the collector is built on NSWorkspace, the
Accessibility API, CoreAudio and SMAppService.

```bash
npm install
npm run build:native
npm run install:agent    # hand-installed launchd agents, for development
npm run permission        # opens the Accessibility prompt and the right pane
npm run dev:app
npm test
```

`npm run dist` builds the signed app instead, which registers its agents
through SMAppService rather than by writing plists into
`~/Library/LaunchAgents`. Both paths exist on purpose: the packaged one is what
people install, the hand-installed one is what you can iterate on.

**One trap worth knowing about**: keep the checkout out of a folder macOS
protects, or run the packaged app from `/Applications`. Under launchd, a
background agent that cannot read `~/Documents` does not get `EPERM` — it
hangs, before the first line of its own code runs.

Two optional keys, set inside the app under **Settings** — never in a file:

| Missing | What goes dark | What still works |
| --- | --- | --- |
| jev (TypeSafe) key | category, project and focus per window | time per app, per window, the ribbon, the charts |
| `claude` login | the journal and the chat | all measurement, all charts |

So an empty install still measures and draws. If the categories stay grey or the
journal will not write, that is a missing key, not a bug.

## The five languages are enforced by the compiler

`src/lib/textos.ts` declares a closed `Textos` type. Adding a key there breaks
the build until all five languages — Portuguese, English, Spanish, French and
German — have a translation. That is deliberate: it is what stops a language
from silently going half-finished.

The same applies to the core, which writes in the chosen language too:
`core/idiomas.ts`, `core/personas.ts` and `core/dossie.ts`.

If you do not speak one of the five, write the string in English in all five
slots and say so in the pull request — someone will fix the wording. That is
much better than not sending the change.

**Never translate a stored key.** `codigo`, `ia`, `distracao` and friends are
identifiers in SQLite. Changing language cannot be allowed to rewrite the past,
so only the display name in `NOMES_CATEGORIA` changes.

## Style

Identifiers and comments are in Brazilian Portuguese. Write new code the same
way if you can; if you cannot, write it in English and it will be reviewed as
is — a correct patch in the wrong language beats no patch.

Comments explain **why**, not what. The code already says what it does. A
comment earns its place by recording the reason a thing is the way it is,
especially when the obvious approach was tried and failed — most of the comments
in `native/` and `app/main.cjs` exist because macOS punished a reasonable idea.

Commit messages are a sentence about what changed from the user's side, not the
file list. `Idle time with an agent working is not idleness`, not
`fix metrics.ts`.

## Never read disk synchronously in a source

`readdirSync`, `readFileSync`, `existsSync`, `openSync` — none of them, anywhere
under `core/sources/`. In a folder macOS protects, they do not return an error.
They stop. And stopped inside the event loop, they stop the whole collector:
the server has already said it is up and no route answers.

`comLimite` exists to keep one bad source from taking the rest down, and it
cannot help here — its own timeout needs the event loop to fire. Async is what
gives the loop back. There is a test that checks this, because the rule was
applied once, in `skysight.ts`, and came back in four other files.

## Before you open the pull request

```bash
npm run build     # typecheck plus the interface build
npm test          # CI runs exactly these two on your pull request
```

Twelve tests so far, in `testes/`. More are welcome, especially around
`core/metrics.ts`, where the focus-session window and the delegated-time
arithmetic live.

## The agents, and why the registrar is signed twice

In the packaged app the collector, the window reader and the listener are login
items registered through `SMAppService`, with their plists inside the bundle at
`Contents/Library/LaunchAgents`. `native/agentes.swift` does the registering and
lives in `Contents/MacOS`, because that is where `Bundle.main` resolves to the
app.

It is re-signed in `afterPack` with the app's own identifier. SMAppService
compares the identity of whoever asks against the app's, and "whoever asks" is
literal — signed under its own filename, registration fails with a bare
"Operation not permitted" and no hint at all.

## Reporting a bug

Most problems on macOS are permissions, and they fail quietly. Please include:

- your macOS version,
- whether **Hippocampus Focus** is listed and enabled under Privacy & Security →
  Accessibility,
- what the sidebar says at the bottom left — it names any source that is
  waiting on a permission,
- the tail of `~/Library/Logs/Hippocampus/collector.log`.

Your database is never needed to diagnose anything, and you should not send it.
It is your day.
