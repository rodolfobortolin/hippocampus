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

echo "$APP pronto e assinado"
codesign -dv "$APP" 2>&1 | grep -E "Identifier|Signature" || true
