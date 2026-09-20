#!/bin/sh
# Compila o helper que amostra o foco do Mac e o empacota como um .app mínimo.
#
# O empacotamento não é capricho: um Mach-O solto não tem identidade de bundle,
# e o macOS trata mal a permissão de Acessibilidade de um binário assim — ele
# nem aparece com nome na lista dos Ajustes. Dentro de um .app com identificador
# próprio e assinatura estável, a autorização é dada uma vez e sobrevive aos
# próximos builds.
set -e
cd "$(dirname "$0")/.."

APP="native/Hipocampo Focus.app"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS"
cp native/Info.plist "$APP/Contents/Info.plist"

swiftc -O -o "$APP/Contents/MacOS/hipocampo-focus" native/focus.swift \
  -framework AppKit -framework ApplicationServices -framework CoreGraphics -framework CoreAudio

# Assinatura ad hoc do bundle inteiro. Sem identidade estável o macOS vê cada
# compilação como um programa novo e a autorização evapora a cada build.
codesign --sign - --force --deep "$APP"

# Atalho fora do bundle para chamadas diretas de linha de comando.
ln -sf "Hipocampo Focus.app/Contents/MacOS/hipocampo-focus" native/hipocampo-focus

echo "$APP pronto e assinado"
codesign -dv "$APP" 2>&1 | grep -E "Identifier|Signature" || true
