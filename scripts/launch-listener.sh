#!/bin/sh
# The wake-word listener. A separate program so it has a microphone permission
# of its own: turning the listening off does not turn the measuring off.
set -e
CONTENTS="$(cd "$(dirname "$0")/../.." && pwd)"
LOGS="$HOME/Library/Logs/Hippocampus"
mkdir -p "$LOGS"
exec >>"$LOGS/listener.log" 2>&1
exec "$CONTENTS/Resources/native/Hippocampus Listener.app/Contents/MacOS/hippocampus-listener" \
  --post http://127.0.0.1:7878/api/wake
