#!/bin/sh
# Notariza o Hipocampo e prega o selo no .dmg.
#
# Assinar com Developer ID basta para a sua própria máquina. A notarização só
# faz falta quando outra pessoa baixa: o Gatekeeper recusa, na primeira
# abertura, um app com Developer ID que a Apple nunca viu — mesmo assinado,
# mesmo íntegro.
#
# Precisa de uma credencial guardada uma vez:
#
#   xcrun notarytool store-credentials hipocampo \
#     --apple-id SEU@EMAIL --team-id T39P8Y6S8L --password SENHA-DE-APP
#
# A senha de app não é a do seu Apple ID: é gerada em appleid.apple.com, em
# "Segurança → Senhas específicas do app". Ela fica no Chaveiro, não aqui.
set -e
cd "$(dirname "$0")/.."

PERFIL="${HIPOCAMPO_NOTARY_PROFILE:-hipocampo}"

if ! xcrun notarytool history --keychain-profile "$PERFIL" >/dev/null 2>&1; then
  cat <<FIM
Não achei a credencial "$PERFIL" no Chaveiro.

Guarde uma vez, com uma senha específica de app criada em appleid.apple.com:

  xcrun notarytool store-credentials $PERFIL \\
    --apple-id SEU@EMAIL --team-id T39P8Y6S8L --password SENHA-DE-APP

Enquanto isso, o app assinado continua funcionando na sua máquina.
FIM
  exit 1
fi

echo "==> compilando e assinando"
npm run build
npx electron-builder --mac --arm64 -c.mac.target=dmg

DMG=$(ls -t release/*.dmg 2>/dev/null | head -1)
[ -n "$DMG" ] || { echo "não achei o .dmg em release/"; exit 1; }

echo "==> enviando $DMG para a Apple (costuma levar alguns minutos)"
xcrun notarytool submit "$DMG" --keychain-profile "$PERFIL" --wait

# Pregar o selo é o que faz o app abrir sem internet: sem o staple, o
# Gatekeeper precisa consultar a Apple toda primeira abertura.
echo "==> pregando o selo"
xcrun stapler staple "$DMG"

echo "==> conferindo como o Gatekeeper vai ver"
spctl --assess --type open --context context:primary-signature -v "$DMG"
xcrun stapler validate "$DMG"

echo
echo "pronto: $DMG"
