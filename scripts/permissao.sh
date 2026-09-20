#!/bin/sh
# Pede a permissão de Acessibilidade, que é o que destrava o título das janelas.
cd "$(dirname "$0")/.."
./native/hipocampo-focus --ask --interval 3600 &
PID=$!
sleep 2
kill $PID 2>/dev/null || true
open "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"
echo "Autorize 'hipocampo-focus' (ou o app que apareceu na lista) e reinicie o coletor:"
echo "  launchctl kickstart -k gui/$(id -u)/com.hipocampo.coletor"
