#!/bin/sh
# Zera e pede de novo a Acessibilidade para o helper.
#
# Necessário depois de recompilar: com assinatura ad hoc, qualquer mudança no
# código muda o hash, e o macOS deixa de honrar a autorização antiga — o
# interruptor continua ligado na tela, mas o sistema nega por dentro. Com um
# Developer ID de verdade isso deixa de acontecer.
set -e
cd "$(dirname "$0")/.."

tccutil reset Accessibility com.hipocampo.focus 2>/dev/null || true

if launchctl print "gui/$(id -u)/com.hipocampo.foco" >/dev/null 2>&1; then
  launchctl kickstart -k "gui/$(id -u)/com.hipocampo.foco"
  echo "Helper reiniciado. Deve aparecer o diálogo pedindo Acessibilidade para"
  echo "\"Hipocampo Focus\" — autorize por ele, não ligando o interruptor à mão:"
  echo "o diálogo grava o requisito de código certo, o interruptor não."
else
  echo "O agente do helper não está instalado. Rode: npm run install:agent"
fi
