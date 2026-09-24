# Hippocampus

A local measure of your day on a Mac. Read `README.md` for what it is and
`CONTRIBUTING.md` for the rule that is not up for negotiation — never score
the person.

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
   The release commit on main republishes the website, whose button names the
   version from package.json — nothing to change on the site by hand.
7. Publishing the release starts `.github/workflows/release.yml`: on a macOS
   runner it builds, signs, notarizes and staples, and attaches the three
   files — the `.dmg` people download, the `-mac.zip` and `latest-mac.yml` the
   installed apps update from. Watch it too; a release without
   `latest-mac.yml` is one no installed app updates to. It needs five secrets
   (listed at the top of the workflow). For a tag whose release has no files,
   run it by hand: `gh workflow run release.yml -f tag=vX.Y.Z`. The local way
   still works — `npm run notarize` with the Keychain credential, or with
   `NOTARY_API_KEY`, `NOTARY_API_KEY_ID` and `NOTARY_API_ISSUER` set — and then
   `gh release upload vX.Y.Z release/vX.Y.Z/*`. Attach a build only if it is
   notarized.
   Without notarization macOS refuses to open it on any other Mac, so a download
   would be a trap; say in the notes that it has to be built from source.
   The first release that attaches a .dmg also sets `DOWNLOAD = true` in
   `site/vite.config.ts`, which swaps the website's "Get it on GitHub" for a
   download button pointing at `releases/latest/download/Hippocampus-arm64.dmg`.

**Updates.** The installed app checks the latest GitHub release on start and
every four hours (`startUpdates` in `app/main.cjs`), downloads it in the
background and installs it on restart, from the menu bar or Settings. The
updater checks that the download carries the same Developer ID; that check is
never switched off. After an update the app restarts the three agents once,
because launchd's processes would otherwise keep running the old code.

Never let electron-builder notarize on its own: it notarizes before the
afterSign hook reseals the app, and the ticket then describes an app that no
longer exists. `scripts/notarize.sh` does it in the right order.

Then tell Rodolfo it went out, with the link — a release is public.

## The website

`site/` is the project's page. The sphere at the top is `src/three/Core.ts`
itself, imported rather than redrawn, so it cannot drift from the app.

The screenshots come from the real app running over an invented week — never
from the real database, which carries client names, ticket numbers and window
titles that do not belong on a public page. When the interface changes enough
that the pictures lie, retake them:

```bash
npm run site:demo                                   # the invented week, in /tmp
HIPPOCAMPUS_DATA=/tmp/hippocampus-demo HIPPOCAMPUS_PORT=7979 \
  node --experimental-strip-types scripts/demo-core.ts &   # the API over it, no collector
npm run build && npx electron scripts/screenshots.cjs /tmp/shots
```

Then convert them to WebP into `site/public/img/` (a PNG of the app is 2.6 MB; the
WebP is under 120 KB) and check that the text beside each picture still
describes it — the Rhythm copy names Thursday at 16h because the capture picks
that cell. `npm run site` serves it; `npm run site:build` builds it into
`site/dist`.

It is published on Vercel at https://hippocampus-black.vercel.app/ — the
project `hippocampus` under rodolfobortolins-projects, connected to this
repository. `vercel.json` says how it is built, and its `ignoreCommand` skips
the build when a push touches neither `site/`, the sphere in `src/three/`, the
lockfile nor `package.json` — the last one because the page names the version.
So the release commit republishes it, and a push that only touches the app
does not.

The address is written once, as `SITE` in `site/vite.config.ts`; the canonical
link, the link previews, `robots.txt` and `sitemap.xml` are all built from it.
Moving the site to its own domain is that line and nothing else.

The old address on GitHub Pages is kept only as a redirect, by
`.github/workflows/site.yml`, so links already out there still land. It is not
a second copy of the site: two copies compete with each other in search.

