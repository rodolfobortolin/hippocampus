#!/bin/sh
# Instala (ou remove) o coletor como agente do launchd: sobe no login e
# volta sozinho se cair. É ele que garante que o dia inteiro seja medido,
# mesmo com o app fechado.
set -e

RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
ETIQUETA="com.hipocampo.coletor"
ETIQUETA_FOCO="com.hipocampo.foco"
PLIST="$HOME/Library/LaunchAgents/$ETIQUETA.plist"
PLIST_FOCO="$HOME/Library/LaunchAgents/$ETIQUETA_FOCO.plist"
APP_FOCO="$RAIZ/native/Hipocampo Focus.app/Contents/MacOS/hipocampo-focus"
LOGS="$HOME/Library/Logs/Hipocampo"
NODE="$(command -v node)"

instalar() {
  [ -x "$NODE" ] || { echo "node não encontrado no PATH"; exit 1; }
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

  # O helper tem agente próprio de propósito: lançado pelo launchd, ele responde
  # por si mesmo no TCC e a permissão de Acessibilidade fica com ele. Lançado
  # pelo coletor, quem apareceria pedindo seria o node — e autorizar o node daria
  # Acessibilidade a qualquer script Node da máquina.
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
  # bootout mata o processo principal, mas um filho vivo é reparentado no
  # launchd em vez de morrer junto. Dois coletores no mesmo banco é problema.
  pkill -f "$RAIZ/core/index.ts" 2>/dev/null || true
  sleep 1
  launchctl bootstrap "gui/$(id -u)" "$PLIST"
  launchctl bootstrap "gui/$(id -u)" "$PLIST_FOCO"
  echo "coletor e helper de foco instalados — sobem junto com a sessão"
  echo
  echo "Na primeira vez o macOS vai pedir Acessibilidade para 'Hipocampo Focus'."
  echo "Agora o pedido vem dele mesmo, não do node — é esse nome que aparece na lista."
  echo "registro: $LOGS/collector.log"
}

remover() {
  # O helper tem agente próprio de propósito: lançado pelo launchd, ele responde
  # por si mesmo no TCC e a permissão de Acessibilidade fica com ele. Lançado
  # pelo coletor, quem apareceria pedindo seria o node — e autorizar o node daria
  # Acessibilidade a qualquer script Node da máquina.
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
  pkill -f "$RAIZ/core/index.ts" 2>/dev/null || true
  rm -f "$PLIST"
  echo "coletor removido (os dados já guardados ficam onde estão)"
}

case "${1:-install}" in
  install) instalar ;;
  uninstall) remover ;;
  *) echo "uso: agent.sh [install|uninstall]"; exit 1 ;;
esac
