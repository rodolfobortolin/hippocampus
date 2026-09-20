#!/bin/sh
# Turns the wake word on (or off).
#
# A separate agent on purpose: it is the one holding the microphone, and
# turning the listening off does not turn the measuring off. Recognition runs
# on macOS itself, on-device — no audio is recorded and none is sent anywhere.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LABEL="com.hippocampus.listener"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
APP="$ROOT/native/Hippocampus Listener.app/Contents/MacOS/hippocampus-listener"
LOGS="$HOME/Library/Logs/Hippocampus"

start() {
  [ -x "$APP" ] || { echo "listener missing — run npm run build:native"; exit 1; }
  mkdir -p "$LOGS" "$HOME/Library/LaunchAgents"
  cat > "$PLIST" <<PLISTEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$APP</string>
    <string>--post</string>
    <string>http://127.0.0.1:7878/api/wake</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ProcessType</key><string>Background</string>
  <key>StandardOutPath</key><string>$LOGS/listener.log</string>
  <key>StandardErrorPath</key><string>$LOGS/listener.log</string>
</dict>
</plist>
PLISTEOF
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
  pkill -f "hippocampus-listener" 2>/dev/null || true
  sleep 1
  launchctl bootstrap "gui/$(id -u)" "$PLIST"
  echo "listener on — say \"Hippocampus\""
  echo "The first time, macOS asks for the microphone and speech recognition"
  echo "for \"Hippocampus Listener\"."
}

stop() {
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
  pkill -f "hippocampus-listener" 2>/dev/null || true
  rm -f "$PLIST"
  echo "listener off"
}

case "${1:-start}" in
  start|on) start ;;
  stop|off) stop ;;
  *) echo "usage: listener.sh [on|off]"; exit 1 ;;
esac
