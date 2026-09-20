#!/bin/sh
# Resets and asks again for Accessibility on behalf of the helper.
#
# Needed after recompiling: with an ad-hoc signature, any change to the code
# changes the hash, and macOS stops honouring the old grant — the switch stays
# on screen while the system denies underneath. With a real Developer ID this
# stops happening.
set -e
cd "$(dirname "$0")/.."

tccutil reset Accessibility com.hippocampus.focus 2>/dev/null || true

if launchctl print "gui/$(id -u)/com.hippocampus.focus" >/dev/null 2>&1; then
  launchctl kickstart -k "gui/$(id -u)/com.hippocampus.focus"
  echo "Helper restarted. A dialog asking for Accessibility for"
  echo "\"Hippocampus Focus\" should appear — authorise through it, not by"
  echo "flipping the switch by hand: the dialog records the right code"
  echo "requirement, the switch does not."
else
  echo "The helper's agent is not up."
  echo "In the app: Settings → measure on its own, from login."
  echo "From source: npm run install:agent."
fi
