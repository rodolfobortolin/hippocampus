#!/bin/sh
# Sobe o núcleo usando o Electron do próprio bundle como Node.
#
# É o que tira a dependência de ter Node instalado: o Electron 44 traz Node 24,
# que é o que o núcleo precisa para `node:sqlite` e para rodar TypeScript
# direto. Antes isto dependia do `node` do PATH, e sob o launchd o PATH é
# mínimo — funcionava por sorte, na máquina de quem desenvolveu.
#
# O redirecionamento do log mora aqui, e não no plist, porque um plist dentro
# do bundle é estático e o launchd não expande `$HOME`.
set -e
CONTENTS="$(cd "$(dirname "$0")/../.." && pwd)"
APP="$CONTENTS/Resources/app"
LOGS="$HOME/Library/Logs/Hipocampo"
mkdir -p "$LOGS"
cd "$APP"
export ELECTRON_RUN_AS_NODE=1
exec >>"$LOGS/collector.log" 2>&1
exec "$CONTENTS/MacOS/Hipocampo" \
  --experimental-strip-types --disable-warning=ExperimentalWarning "$APP/core/index.ts"
