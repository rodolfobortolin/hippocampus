#!/bin/sh
# Compila o helper nativo que amostra o foco do Mac.
set -e
cd "$(dirname "$0")/.."
swiftc -O -o native/hipocampo-focus native/focus.swift \
  -framework AppKit -framework ApplicationServices -framework CoreGraphics -framework CoreAudio

# Assinatura ad hoc estável. Sem ela o macOS enxerga cada compilação como um
# binário diferente e a permissão de Acessibilidade evapora a cada build —
# você autoriza hoje e amanhã ele volta sem título de janela.
codesign --sign - --force --preserve-metadata=entitlements native/hipocampo-focus 2>/dev/null \
  || codesign --sign - --force native/hipocampo-focus

echo "native/hipocampo-focus pronto e assinado"
