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
mkdir -p "$APP/Contents/Resources"
[ -f build/hipocampo.icns ] && cp build/hipocampo.icns "$APP/Contents/Resources/hipocampo.icns"

swiftc -O -o "$APP/Contents/MacOS/hipocampo-focus" native/focus.swift \
  -framework AppKit -framework ApplicationServices -framework CoreGraphics -framework CoreAudio

# Assina com o Developer ID quando existir. Isso não é sobre distribuição: a
# autorização de Acessibilidade fica amarrada à identidade do certificado, que
# não muda entre compilações. Com assinatura ad hoc ela é amarrada ao hash do
# código, então cada `npm run build:native` derrubava a permissão em silêncio —
# o interruptor seguia ligado na tela e o sistema negava por dentro.
IDENTIDADE=$(security find-identity -v -p codesigning 2>/dev/null \
  | grep "Developer ID Application" | head -1 | sed 's/.*"\(.*\)"/\1/')

if [ -n "$IDENTIDADE" ]; then
  # Sem --options runtime de propósito: o runtime endurecido só é exigido para
  # notarização, e aqui ele fazia o sistema cobrar entitlement de microfone para
  # uma consulta que não grava nada, só pergunta se algum dispositivo está ativo.
  codesign --sign "$IDENTIDADE" --force --deep "$APP"
  echo "assinado com: $IDENTIDADE"
else
  codesign --sign - --force --deep "$APP"
  echo "assinado ad hoc (sem Developer ID no chaveiro) — a permissão vai cair a cada build"
fi

# Atalho fora do bundle para chamadas diretas de linha de comando.
ln -sf "Hipocampo Focus.app/Contents/MacOS/hipocampo-focus" native/hipocampo-focus

# O ouvido é um programa à parte: permissão de microfone própria, e desligar
# a escuta não desliga a medição.
OUVIDO="native/Hipocampo Ouvido.app"
rm -rf "$OUVIDO"
mkdir -p "$OUVIDO/Contents/MacOS" "$OUVIDO/Contents/Resources"
cp native/InfoOuvido.plist "$OUVIDO/Contents/Info.plist"
[ -f build/hipocampo.icns ] && cp build/hipocampo.icns "$OUVIDO/Contents/Resources/hipocampo.icns"
swiftc -O -o "$OUVIDO/Contents/MacOS/hipocampo-ouvido" native/ouvido.swift \
  -framework AVFoundation -framework Speech -framework Foundation
if [ -n "$IDENTIDADE" ]; then
  codesign --sign "$IDENTIDADE" --force --deep "$OUVIDO"
else
  codesign --sign - --force --deep "$OUVIDO"
fi

# O registrador dos agentes. Mora em Contents/MacOS do app principal, e não
# aqui, porque é de lá que Bundle.main resolve para o app — que é o que o
# SMAppService consulta para saber de quem são os agentes.
mkdir -p native/bin
swiftc -O -o native/bin/hipocampo-agentes native/agentes.swift -framework ServiceManagement
echo "registrador de agentes pronto"

echo "$APP pronto e assinado"
echo "$OUVIDO pronto e assinado"
codesign -dv "$APP" 2>&1 | grep -E "Identifier|Signature" || true
