# Hippocampus

A local measure of your day on a Mac. Read `README.md` for what it is and
`CONTRIBUTING.md` for the two rules that are not up for negotiation — never
take a screenshot, and never score the person.

## Commit messages

English, like the rest of the project. One logical change per commit. An
imperative subject line, 50 characters as a target and 72 as the ceiling. A
blank line, then a body explaining **why** — the diff already shows the what.
If the subject needs an "and" to fit, it is two commits.

No attribution line: no `Co-Authored-By`, no mention of which model or tool
wrote the code. The commit's author is whoever answers for it.

```
Hide the floating core instead of closing it

Closing destroyed the WebGL scene, so the wake word had to wait for it to load
again before it could listen.
```

When the reason came from a measurement, the number goes in the body. "It gives
up after seven seconds" is worth less than "at rest closed, five seconds after
the wake word open, fifteen seconds later closed again".

## Comments

They explain why, not what, and they are in English like the code. Where they
matter most is `native/` and `app/main.cjs`: nearly every comment there exists
because macOS punished a reasonable idea, and without the record someone
reintroduces the idea.

## Before saying it is done

```bash
npm run build     # types and the interface
npm test          # CI runs both of these
```

Touched the core? Restart it and check it came back whole:

```bash
launchctl kickstart -k gui/$(id -u)/com.hippocampus.collector
curl -s http://127.0.0.1:7878/api/status
```

## The five languages are checked by the compiler

`src/lib/strings.ts` has a closed type: adding a key breaks the build until all
five languages carry a translation. That is deliberate. The same holds in the
core, in `core/languages.ts`, `core/personas.ts` and `core/dossier.ts`.

Never translate a key stored in the database (`code`, `ai`, `distraction`):
switching language cannot rewrite the past. Only the displayed name changes, in
`CATEGORY_NAMES`.

## Synchronous disk is forbidden in the sources

No `readdirSync`, `readFileSync`, `existsSync` or `openSync` anywhere under
`core/sources/`. In a folder macOS protects, those calls do not return an error
— they stop, and stop the whole collector with them. `withTimeout` cannot save
it, because its own timeout also needs the event loop. A test checks this.

For the same reason the packaged app runs from `/Applications`: under launchd,
Node cannot even load its own files out of `~/Documents`.

## The agents

In the packaged app the three agents — collector, focus and listener — are
login items registered by `SMAppService`, with their plists inside the bundle
at `Contents/Library/LaunchAgents`. `native/agents.swift` does the registering
and lives in `Contents/MacOS`, because that is where `Bundle.main` resolves to
the app.

`scripts/agent.sh`, which writes plists by hand into `~/Library/LaunchAgents`,
still exists for development.

**The registrar has to be signed with the app's identifier.** SMAppService
compares the identity of whoever asks against the app's, and "whoever asks" is
literal. Signed under its filename, registration fails with a bare "Operation
not permitted" and no hint at all. That is what `build/sign-registrar.cjs` does
in afterSign, before the seal.

## Keys

They live in the macOS Keychain, written through the Settings screen. Never in
a file, never in a commit, never in a process argument — any `ps` reads an
argument. A `.env` exists only for development and loses to the Keychain.

## The name

The app was called Hipocampo before it was called Hippocampus. The old name
survives only where it has to: the Keychain service read as a fallback, the
settings row read in its old shape, the vault marker already sitting in
people's notes, and the migration map from the old category keys. Everywhere
else it is gone.
