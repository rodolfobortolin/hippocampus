#!/bin/sh
# Instala (ou remove) o coletor como agente do launchd: sobe no login e
# volta sozinho se cair. É ele que garante que o dia inteiro seja medido,
# mesmo com o app fechado.
set -e

RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
ETIQUETA="com.hipocampo.coletor"
PLIST="$HOME/Library/LaunchAgents/$ETIQUETA.plist"
LOGS="$HOME/Library/Logs/Hipocampo"
NODE="$(command -v node)"

instalar() {
  [ -x "$NODE" ] || { echo "node não encontrado no PATH"; exit 1; }
  [ -x "$RAIZ/native/hipocampo-focus" ] || { echo "helper nativo ausente — rode npm run build:native"; exit 1; }

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
    <string>$RAIZ/core/index.ts</string>
  </array>
  <key>WorkingDirectory</key><string>$RAIZ</string>
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

  launchctl bootout "gui/$(id -u)/$ETIQUETA" 2>/dev/null || true
  # bootout mata o processo principal, mas um filho vivo é reparentado no
  # launchd em vez de morrer junto. Dois coletores no mesmo banco é problema.
  pkill -f "$RAIZ/core/index.ts" 2>/dev/null || true
  sleep 1
  launchctl bootstrap "gui/$(id -u)" "$PLIST"
  echo "coletor instalado — sobe junto com a sessão"
  echo "registro: $LOGS/collector.log"
}

remover() {
  launchctl bootout "gui/$(id -u)/$ETIQUETA" 2>/dev/null || true
  pkill -f "$RAIZ/core/index.ts" 2>/dev/null || true
  rm -f "$PLIST"
  echo "coletor removido (os dados já guardados ficam onde estão)"
}

case "${1:-install}" in
  install) instalar ;;
  uninstall) remover ;;
  *) echo "uso: agent.sh [install|uninstall]"; exit 1 ;;
esac
