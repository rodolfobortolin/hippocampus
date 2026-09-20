#!/bin/sh
# Compila o helper nativo que amostra o foco do Mac.
set -e
cd "$(dirname "$0")/.."
swiftc -O -o native/hipocampo-focus native/focus.swift \
  -framework AppKit -framework ApplicationServices -framework CoreGraphics
echo "native/hipocampo-focus pronto"
