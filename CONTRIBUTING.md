# Contributing

Thanks for looking. A few things are worth knowing before you spend an evening
on this, because some of them are not obvious from the code.

## Two rules that are not up for negotiation

**No screenshots.** Hipocampo reads what is already text — window titles, tab
URLs, commands, commits. It never captures the screen, and it never will. This
is what makes it cheap, battery-friendly, free of the orange recording dot, and
sellable in the EU. A pull request that adds screen capture, OCR or a vision
model will be declined no matter how well it is written.

**No scoring the person.** The journal is a `git log`: a record of what
happened, not a verdict on who did it. No productivity score, no streak, no
grade, no goal the user did not declare, no comparison with an ideal day. The
number-one cause of abandonment in this category is guilt, and everything here
is shaped around not producing it. If a feature only makes sense as "you did
badly today", it does not belong.

Everything else is open, including disagreeing with how any of it was built.

## What you need to run it

macOS, Node 24+, and Xcode command line tools for the Swift helper. There is no
way around the Mac: the collector is built on NSWorkspace, the Accessibility
API and CoreAudio.

```bash
npm install
npm run build:native
npm run install:agent
npm run permissao        # opens the Accessibility prompt and the right pane
npm run dev:app
```

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
file list. `Tempo parado com agente trabalhando não é ociosidade`, not
`fix metrics.ts`.

## Before you open the pull request

```bash
npm run build     # typecheck plus the interface build; CI runs exactly this
```

There are no tests yet. If you are adding something with real logic in it —
anything in `core/metrics.ts` especially — tests would be very welcome.

## Reporting a bug

Most problems on macOS are permissions, and they fail quietly. Please include:

- your macOS version,
- whether **Hipocampo Focus** is listed and enabled under Privacy & Security →
  Accessibility,
- what the sidebar says at the bottom left — it names any source that is
  waiting on a permission,
- the tail of `~/Library/Logs/Hipocampo/collector.log`.

Your database is never needed to diagnose anything, and you should not send it.
It is your day.
