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
npm test          # the same two CI runs, on releases and pull requests
```

CI does not run on a push to main, so this is the check a commit gets. The
runner is Linux, and a test that needs macOS passes here and fails there. Before
a push that touched tests, run the suite as the runner would:

```bash
node --experimental-strip-types --disable-warning=ExperimentalWarning \
  --import 'data:text/javascript,Object.defineProperty(process,"platform",{value:"linux"})' \
  --test "tests/*.test.ts"
```

Add `HIPPOCAMPUS_DATA=$(mktemp -d)` in front for the runner's empty database. A
test that needs macOS skips itself with the reason, `{ skip: process.platform
!== 'darwin' && '…' }` — skipped where it cannot run, never passed there.

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

## CI and releases

The pipeline runs on a release tag, on a pull request and by hand — not on
every push to main. Day-to-day commits are checked locally; running the same
checks again on each push spends minutes to confirm what is already known.

**Keep the record as you go.** Every change someone using the app would notice
gets a line under `## Unreleased` in `CHANGELOG.md`, in the same commit that
makes it. Written for the person using it — "Clicking a cell narrows the charts
under it" — not for the diff. Refactors, tests and docs do not get a line.

**Cut a release when it is worth one**, and it is Claude's call to make:

- A coherent set of changes has built up — roughly five or more lines under
  Unreleased that belong together, or one feature big enough to stand alone.
- A fix for something that loses data, stops the measuring or keeps the app
  from opening: release it promptly, even alone.
- About three weeks have passed since the last release and Unreleased has
  anything worth shipping.

Not for docs, tests or refactors alone. Never with Unreleased empty, never with
a test failing, never in the middle of a change that is only half done.

**How:**

1. `npm run build && npm test`, and the Linux run above.
2. Pick the version. Before 1.0: a new feature bumps the minor (0.2.0), fixes
   alone bump the patch (0.1.1). `package.json` is the only place it is written
   — `core/version.ts` reads it.
3. Move the Unreleased lines under `## vX.Y.Z — YYYY-MM-DD`, leave Unreleased
   with "Nothing yet.", and commit that as `Release vX.Y.Z`.
4. Tag `vX.Y.Z` and push the commit and the tag. That starts the one CI run.
5. Watch it: `gh run watch <id> --exit-status`. Red means no release — fix it
   first.
6. Green: `gh release create vX.Y.Z --title vX.Y.Z --notes-file <that section>`.
7. Attach a build only if it is notarized (`npm run notarize` succeeded).
   Without notarization macOS refuses to open it on any other Mac, so a download
   would be a trap; say in the notes that it has to be built from source.

Then tell Rodolfo it went out, with the link — a release is public.

