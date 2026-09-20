#!/bin/sh
# O helper que lê a janela da frente. Lançado pelo launchd, e não pelo núcleo,
# de propósito: assim ele responde por si mesmo no TCC e a permissão de
# Acessibilidade fica com "Hipocampo Focus", não com quem o lançou.
set -e
CONTENTS="$(cd "$(dirname "$0")/../.." && pwd)"
LOGS="$HOME/Library/Logs/Hipocampo"
mkdir -p "$LOGS"
exec >>"$LOGS/foco.log" 2>&1
exec "$CONTENTS/Resources/native/Hipocampo Focus.app/Contents/MacOS/hipocampo-focus" \
  --post http://127.0.0.1:7878/api/amostra --interval 4
