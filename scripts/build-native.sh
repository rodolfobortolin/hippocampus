#!/bin/sh
# Builds the helper that samples the Mac's focus and packages it as a minimal .app.
#
# The packaging is not a flourish: a bare Mach-O has no bundle identity, and
# macOS treats the Accessibility grant of such a binary badly — it
# nor does it show up by name in the Settings list. Inside a .app with an identifier
# identifier and a stable signature, the grant is given once and survives the
# builds that follow.
set -e
cd "$(dirname "$0")/.."

APP="native/Hippocampus Focus.app"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS"
cp native/Info.plist "$APP/Contents/Info.plist"
mkdir -p "$APP/Contents/Resources"
[ -f build/hippocampus.icns ] && cp build/hippocampus.icns "$APP/Contents/Resources/hippocampus.icns"

swiftc -O -o "$APP/Contents/MacOS/hippocampus-focus" native/focus.swift \
  -framework AppKit -framework ApplicationServices -framework CoreGraphics -framework CoreAudio -framework CoreMediaIO -framework EventKit

# Signs with the Developer ID when one exists. This is not about distribution:
# the Accessibility grant binds to the certificate identity, which does not
# change between builds. With an ad-hoc signature it binds to the code hash, so
# every `npm run build:native` used to drop the permission silently —
# o interruptor seguia ligado na tela e o sistema negava por dentro.
IDENTITY=$(security find-identity -v -p codesigning 2>/dev/null \
  | grep "Developer ID Application" | head -1 | sed 's/.*"\(.*\)"/\1/')

if [ -n "$IDENTITY" ]; then
  # No --options runtime on purpose: the hardened runtime is only required for
  # notarisation, and here it made the system demand a microphone entitlement
  # for a query that records nothing and only asks whether a device is active.
  codesign --sign "$IDENTITY" --force --deep "$APP"
  echo "signed with: $IDENTITY"
else
  codesign --sign - --force --deep "$APP"
  echo "signed ad hoc (no Developer ID in the keychain) — the grant will drop every build"
fi

# A shortcut outside the bundle, for direct command-line calls.
ln -sf "Hippocampus Focus.app/Contents/MacOS/hippocampus-focus" native/hippocampus-focus

# The listener is a separate program: a microphone permission of its own, and
# turning the listening off does not turn the measuring off.
LISTENER="native/Hippocampus Listener.app"
rm -rf "$LISTENER"
mkdir -p "$LISTENER/Contents/MacOS" "$LISTENER/Contents/Resources"
cp native/InfoListener.plist "$LISTENER/Contents/Info.plist"
[ -f build/hippocampus.icns ] && cp build/hippocampus.icns "$LISTENER/Contents/Resources/hippocampus.icns"
swiftc -O -o "$LISTENER/Contents/MacOS/hippocampus-listener" native/listener.swift \
  -framework AVFoundation -framework Speech -framework Foundation
if [ -n "$IDENTITY" ]; then
  codesign --sign "$IDENTITY" --force --deep "$LISTENER"
else
  codesign --sign - --force --deep "$LISTENER"
fi

# The agent registrar. It lives in the main app's Contents/MacOS rather than
# here, because that is where Bundle.main resolves to the app — which is what
# SMAppService consults to know whose agents these are.
mkdir -p native/bin
swiftc -O -o native/bin/hippocampus-agents native/agents.swift -framework ServiceManagement
echo "agent registrar ready"

# The screen helper sits beside it in Contents/MacOS. The core runs it only
# when someone asks to be looked at; Screen Recording is then asked for on
# behalf of the app that owns the core, which is Hippocampus.
swiftc -O -o native/bin/hippocampus-screen native/screen.swift \
  -framework ScreenCaptureKit -framework AppKit -framework ApplicationServices -framework CoreGraphics -framework ImageIO -framework UniformTypeIdentifiers
echo "screen helper ready"

echo "$APP ready and signed"
echo "$LISTENER ready and signed"
codesign -dv "$APP" 2>&1 | grep -E "Identifier|Signature" || true
