#!/bin/sh
# Builds the helper that samples the Mac's focus and packages it as a minimal .app.
#
# The packaging is not a flourish: a bare Mach-O has no bundle identity, and
# macOS treats the Accessibility grant of such a binary badly — it
# nem aparece com nome na lista dos Ajustes. Dentro de um .app com identificador
# identifier and a stable signature, the grant is given once and survives the
# builds that follow.
set -e
cd "$(dirname "$0")/.."

APP="native/Hippocampus Focus.app"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS"
cp native/Info.plist "$APP/Contents/Info.plist"
mkdir -p "$APP/Contents/Resources"
[ -f build/hipocampo.icns ] && cp build/hipocampo.icns "$APP/Contents/Resources/hipocampo.icns"

swiftc -O -o "$APP/Contents/MacOS/hippocampus-focus" native/focus.swift \
  -framework AppKit -framework ApplicationServices -framework CoreGraphics -framework CoreAudio

# Signs with the Developer ID when one exists. This is not about distribution:
# the Accessibility grant binds to the certificate identity, which does not
# change between builds. With an ad-hoc signature it binds to the code hash, so
# every `npm run build:native` used to drop the permission silently —
# o interruptor seguia ligado na tela e o sistema negava por dentro.
IDENTIDADE=$(security find-identity -v -p codesigning 2>/dev/null \
  | grep "Developer ID Application" | head -1 | sed 's/.*"\(.*\)"/\1/')

if [ -n "$IDENTIDADE" ]; then
  # No --options runtime on purpose: the hardened runtime is only required for
  # notarisation, and here it made the system demand a microphone entitlement
  # for a query that records nothing and only asks whether a device is active.
  codesign --sign "$IDENTIDADE" --force --deep "$APP"
  echo "assinado com: $IDENTIDADE"
else
  codesign --sign - --force --deep "$APP"
  echo "signed ad hoc (no Developer ID in the keychain) — the grant will drop every build"
fi

# Atalho fora do bundle para chamadas diretas de linha de comando.
ln -sf "Hippocampus Focus.app/Contents/MacOS/hippocampus-focus" native/hippocampus-focus

# The listener is a separate program: a microphone permission of its own, and
# turning the listening off does not turn the measuring off.
OUVIDO="native/Hippocampus Listener.app"
rm -rf "$OUVIDO"
mkdir -p "$OUVIDO/Contents/MacOS" "$OUVIDO/Contents/Resources"
cp native/InfoListener.plist "$OUVIDO/Contents/Info.plist"
[ -f build/hipocampo.icns ] && cp build/hipocampo.icns "$OUVIDO/Contents/Resources/hipocampo.icns"
swiftc -O -o "$OUVIDO/Contents/MacOS/hippocampus-listener" native/listener.swift \
  -framework AVFoundation -framework Speech -framework Foundation
if [ -n "$IDENTIDADE" ]; then
  codesign --sign "$IDENTIDADE" --force --deep "$OUVIDO"
else
  codesign --sign - --force --deep "$OUVIDO"
fi

# The agent registrar. It lives in the main app's Contents/MacOS rather than
# here, because that is where Bundle.main resolves to the app — which is what
# SMAppService consults to know whose agents these are.
mkdir -p native/bin
swiftc -O -o native/bin/hippocampus-agents native/agents.swift -framework ServiceManagement
echo "agent registrar ready"

echo "$APP ready and signed"
echo "$OUVIDO ready and signed"
codesign -dv "$APP" 2>&1 | grep -E "Identifier|Signature" || true
