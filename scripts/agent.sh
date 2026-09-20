#!/bin/sh
# Installs (or removes) the collector as a launchd agent, writing plists by hand
# into ~/Library/LaunchAgents.
#
# This is the development path. The packaged app does not use it: there the
# three agents are login items registered through SMAppService, with the plists
# inside the bundle itself, and they show up in Settings → General → Login
# Items. Both use the same labels, so they do not coexist — turn one off before
# turning the other on.
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Inside the packaged bundle the pieces sit in sibling folders: the code in
# Contents/Resources/app and the extra resources in Contents/Resources. In the
# repository everything shares one root. Looking in both avoids an installer
# that only works one way.
if [ -f "$ROOT/core/index.ts" ]; then
  CODE_ROOT="$ROOT"
elif [ -f "$ROOT/app/core/index.ts" ]; then
  CODE_ROOT="$ROOT/app"
else
  echo "could not find core/index.ts from $ROOT"; exit 1
fi
LABEL="com.hippocampus.collector"
LABEL_FOCUS="com.hippocampus.focus"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
PLIST_FOCUS="$HOME/Library/LaunchAgents/$LABEL_FOCUS.plist"
FOCUS_APP="$ROOT/native/Hippocampus Focus.app/Contents/MacOS/hippocampus-focus"
LOGS="$HOME/Library/Logs/Hippocampus"
NODE="$(command -v node)"

install_agents() {
  [ -x "$NODE" ] || { echo "node not found on PATH"; exit 1; }
  [ -x "$FOCUS_APP" ] || { echo "native helper missing — run npm run build:native"; exit 1; }

  mkdir -p "$LOGS" "$HOME/Library/LaunchAgents"
  cat > "$PLIST" <<PLISTEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE</string>
    <string>--experimental-strip-types</string>
    <string>--disable-warning=ExperimentalWarning</string>
    <string>$CODE_ROOT/core/index.ts</string>
  </array>
  <key>WorkingDirectory</key><string>$CODE_ROOT</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>$HOME/.local/bin:$HOME/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ProcessType</key><string>Background</string>
  <key>StandardOutPath</key><string>$LOGS/collector.log</string>
  <key>StandardErrorPath</key><string>$LOGS/collector.log</string>
</dict>
</plist>
PLISTEOF

  # The helper has an agent of its own on purpose: launched by launchd, it
  # answers for itself in the TCC and the Accessibility grant belongs to it.
  # Launched by the collector, what would show up asking is node — and
  # authorising node would grant Accessibility to every Node script on the
  # machine.
  cat > "$PLIST_FOCUS" <<FOCUSEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL_FOCUS</string>
  <key>ProgramArguments</key>
  <array>
    <string>$FOCUS_APP</string>
    <string>--post</string>
    <string>http://127.0.0.1:7878/api/sample</string>
    <string>--interval</string>
    <string>4</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ProcessType</key><string>Background</string>
  <key>StandardErrorPath</key><string>$LOGS/focus.log</string>
</dict>
</plist>
FOCUSEOF

  launchctl bootout "gui/$(id -u)/$LABEL_FOCUS" 2>/dev/null || true
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
  # bootout kills the main process, but a surviving child gets reparented to
  # launchd instead of dying with it. Two collectors on one database is trouble.
  pkill -f "$CODE_ROOT/core/index.ts" 2>/dev/null || true
  sleep 1
  launchctl bootstrap "gui/$(id -u)" "$PLIST"
  launchctl bootstrap "gui/$(id -u)" "$PLIST_FOCUS"
  echo "collector and focus helper installed — they start with the session"
  echo
  echo "The first time, macOS asks for Accessibility for 'Hippocampus Focus'."
  echo "The prompt now comes from it, not from node — that is the name in the list."
  echo "log: $LOGS/collector.log"
}

uninstall_agents() {
  launchctl bootout "gui/$(id -u)/$LABEL_FOCUS" 2>/dev/null || true
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
  # bootout kills the main process, but a surviving child gets reparented to
  # launchd instead of dying with it.
  pkill -f "$CODE_ROOT/core/index.ts" 2>/dev/null || true
  rm -f "$PLIST" "$PLIST_FOCUS"
  echo "collector removed (whatever was already stored stays where it is)"
}

case "${1:-install}" in
  install) install_agents ;;
  uninstall) uninstall_agents ;;
  *) echo "usage: agent.sh [install|uninstall]"; exit 1 ;;
esac
