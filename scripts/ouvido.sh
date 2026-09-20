#!/bin/sh
# Liga (ou desliga) a palavra de ativação.
#
# É um agente separado de propósito: o microfone fica com ele, e desligar a
# escuta não desliga a medição. O reconhecimento roda no próprio macOS, em
# modo local — nenhum áudio é gravado nem enviado a lugar nenhum.
set -e
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
ETIQUETA="com.hipocampo.ouvido"
PLIST="$HOME/Library/LaunchAgents/$ETIQUETA.plist"
APP="$RAIZ/native/Hipocampo Ouvido.app/Contents/MacOS/hipocampo-ouvido"
LOGS="$HOME/Library/Logs/Hipocampo"

ligar() {
  [ -x "$APP" ] || { echo "ouvido ausente — rode npm run build:native"; exit 1; }
  mkdir -p "$LOGS" "$HOME/Library/LaunchAgents"
  cat > "$PLIST" <<PLISTEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$ETIQUETA</string>
  <key>ProgramArguments</key>
  <array>
    <string>$APP</string>
    <string>--post</string>
    <string>http://127.0.0.1:7878/api/acordar</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ProcessType</key><string>Background</string>
  <key>StandardOutPath</key><string>$LOGS/ouvido.log</string>
  <key>StandardErrorPath</key><string>$LOGS/ouvido.log</string>
</dict>
</plist>
PLISTEOF
  launchctl bootout "gui/$(id -u)/$ETIQUETA" 2>/dev/null || true
  pkill -f "hipocampo-ouvido" 2>/dev/null || true
  sleep 1
  launchctl bootstrap "gui/$(id -u)" "$PLIST"
  echo "ouvido ligado — diga \"Hipocampo\""
  echo "Na primeira vez o macOS pede microfone e reconhecimento de fala"
  echo "para \"Hipocampo Ouvido\"."
}

desligar() {
  launchctl bootout "gui/$(id -u)/$ETIQUETA" 2>/dev/null || true
  pkill -f "hipocampo-ouvido" 2>/dev/null || true
  rm -f "$PLIST"
  echo "ouvido desligado"
}

case "${1:-ligar}" in
  ligar|on) ligar ;;
  desligar|off) desligar ;;
  *) echo "uso: ouvido.sh [ligar|desligar]"; exit 1 ;;
esac
