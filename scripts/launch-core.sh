#!/bin/sh
# Starts the core using the bundle's own Electron as Node.
#
# This is what removes the dependency on having Node installed: Electron 44
# ships Node 24, which is what the core needs for `node:sqlite` and for running
# TypeScript directly. Before, this relied on the `node` on PATH, and under
# launchd the PATH is minimal — it worked by luck, on the machine of whoever
# wrote it.
#
# The log redirection lives here and not in the plist, because a plist inside a
# bundle is static and launchd does not expand `$HOME`.
set -e
CONTENTS="$(cd "$(dirname "$0")/../.." && pwd)"
APP="$CONTENTS/Resources/app"
LOGS="$HOME/Library/Logs/Hippocampus"
mkdir -p "$LOGS"
cd "$APP"
export ELECTRON_RUN_AS_NODE=1
exec >>"$LOGS/collector.log" 2>&1
exec "$CONTENTS/MacOS/Hippocampus" \
  --experimental-strip-types --disable-warning=ExperimentalWarning "$APP/core/index.ts"
