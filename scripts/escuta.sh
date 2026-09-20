#!/bin/sh
# A escuta da palavra de ativação. Programa à parte para ter permissão de
# microfone própria: desligar a escuta não desliga a medição.
set -e
CONTENTS="$(cd "$(dirname "$0")/../.." && pwd)"
LOGS="$HOME/Library/Logs/Hipocampo"
mkdir -p "$LOGS"
exec >>"$LOGS/ouvido.log" 2>&1
exec "$CONTENTS/Resources/native/Hipocampo Ouvido.app/Contents/MacOS/hipocampo-ouvido" \
  --post http://127.0.0.1:7878/api/acordar
