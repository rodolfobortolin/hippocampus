#!/bin/sh
# Installs (or removes) the collector as a launchd agent, writing plists by hand
# em ~/Library/LaunchAgents.
#
# This is the development path. The packaged app does not use it: there the
# three agents are login items registered through SMAppService, with the plists
# inside the bundle itself, and they show up in Settings → General → Login
# Items. Both use the same labels, so they do not coexist — turn one off before
# turning the other on.
set -e

RAIZ="$(cd "$(dirname "$0")/.." && pwd)"

# Inside the packaged bundle the pieces sit in sibling folders: the code in
# Contents/Resources/app e os recursos extras em Contents/Resources. No
# the repository everything shares one root. Looking in both avoids an
# installer that only works one way.
if [ -f "$RAIZ/core/index.ts" ]; then
  RAIZ_CODIGO="$RAIZ"
elif [ -f "$RAIZ/app/core/index.ts" ]; then
  RAIZ_CODIGO="$RAIZ/app"
else
  echo "could not find core/index.ts from $RAIZ"; exit 1
fi
ETIQUETA="com.hippocampus.collector"
ETIQUETA_FOCO="com.hippocampus.focus"
PLIST="$HOME/Library/LaunchAgents/$ETIQUETA.plist"
PLIST_FOCO="$HOME/Library/LaunchAgents/$ETIQUETA_FOCO.plist"
APP_FOCO="$RAIZ/native/Hippocampus Focus.app/Contents/MacOS/hippocampus-focus"
LOGS="$HOME/Library/Logs/Hippocampus"
NODE="$(command -v node)"

instalar() {
  [ -x "$NODE" ] || { echo "node not found on PATH"; exit 1; }
  [ -x "$APP_FOCO" ] || { echo "helper nativo ausente — rode npm run build:native"; exit 1; }

  mkdir -p "$LOGS" "$HOME/Library/LaunchAgents"
  cat > "$PLIST" <<PLISTEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$ETIQUETA</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE</string>
    <string>--experimental-strip-types</string>
    <string>--disable-warning=ExperimentalWarning</string>
    <string>$RAIZ_CODIGO/core/index.ts</string>
  </array>
  <key>WorkingDirectory</key><string>$RAIZ_CODIGO</string>
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
  # Launched
  # pelo coletor, quem apareceria pedindo seria o node — e autorizar o node daria
  # Accessibility to every Node script on the machine.
  cat > "$PLIST_FOCO" <<FOCOEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$ETIQUETA_FOCO</string>
  <key>ProgramArguments</key>
  <array>
    <string>$APP_FOCO</string>
    <string>--post</string>
    <string>http://127.0.0.1:7878/api/amostra</string>
    <string>--interval</string>
    <string>4</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ProcessType</key><string>Background</string>
  <key>StandardErrorPath</key><string>$LOGS/foco.log</string>
</dict>
</plist>
FOCOEOF

  launchctl bootout "gui/$(id -u)/$ETIQUETA_FOCO" 2>/dev/null || true
  launchctl bootout "gui/$(id -u)/$ETIQUETA" 2>/dev/null || true
  # bootout kills the main process, but a surviving child gets reparented to
  # launchd instead of dying with it. Two collectors on one database is trouble.
  pkill -f "$RAIZ_CODIGO/core/index.ts" 2>/dev/null || true
  sleep 1
  launchctl bootstrap "gui/$(id -u)" "$PLIST"
  launchctl bootstrap "gui/$(id -u)" "$PLIST_FOCO"
  echo "collector and focus helper installed — they start with the session"
  echo
  echo "Na primeira vez o macOS vai pedir Acessibilidade para 'Hipocampo Focus'."
  echo "The prompt now comes from it, not from node — that is the name in the list."
  echo "registro: $LOGS/collector.log"
}

remover() {
  # The helper has an agent of its own on purpose: launched by launchd, it
  # answers for itself in the TCC and the Accessibility grant belongs to it.
  # Launched
  # pelo coletor, quem apareceria pedindo seria o node — e autorizar o node daria
  # Accessibility to every Node script on the machine.
  cat > "$PLIST_FOCO" <<FOCOEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$ETIQUETA_FOCO</string>
  <key>ProgramArguments</key>
  <array>
    <string>$APP_FOCO</string>
    <string>--post</string>
    <string>http://127.0.0.1:7878/api/amostra</string>
    <string>--interval</string>
    <string>4</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ProcessType</key><string>Background</string>
  <key>StandardErrorPath</key><string>$LOGS/foco.log</string>
</dict>
</plist>
FOCOEOF

  launchctl bootout "gui/$(id -u)/$ETIQUETA_FOCO" 2>/dev/null || true
  launchctl bootout "gui/$(id -u)/$ETIQUETA" 2>/dev/null || true
  pkill -f "$RAIZ_CODIGO/core/index.ts" 2>/dev/null || true
  rm -f "$PLIST"
  echo "collector removed (whatever was already stored stays where it is)"
}

case "${1:-install}" in
  install) instalar ;;
  uninstall) remover ;;
  *) echo "uso: agent.sh [install|uninstall]"; exit 1 ;;
esac
