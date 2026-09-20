#!/bin/sh
# The helper that reads the window in front. Launched by launchd rather than by
# the core, on purpose: that way it answers for itself in the TCC and the
# Accessibility grant belongs to "Hippocampus Focus", not to whoever started it.
set -e
CONTENTS="$(cd "$(dirname "$0")/../.." && pwd)"
LOGS="$HOME/Library/Logs/Hippocampus"
mkdir -p "$LOGS"
exec >>"$LOGS/focus.log" 2>&1
exec "$CONTENTS/Resources/native/Hippocampus Focus.app/Contents/MacOS/hippocampus-focus" \
  --post http://127.0.0.1:7878/api/sample --interval 4
