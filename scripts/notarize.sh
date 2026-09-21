#!/bin/sh
# Builds what a release carries: the app notarised and stapled, a .dmg to
# download from the website, and the zip and latest-mac.yml the app's own
# updater reads.
#
# Signing with a Developer ID is enough for your own machine. Notarisation only
# matters when someone else downloads it: Gatekeeper refuses, on first open, a
# Developer ID app Apple has never seen — signed, intact, and still refused.
#
# The order is the whole point of this script. electron-builder can notarise
# on its own, but it does so right after signing and *before* the afterSign
# hook, and that hook re-signs the agent registrar and reseals the app
# (build/sign-registrar.cjs). A ticket issued before the reseal describes an
# app that no longer exists a second later. So the app is built and sealed
# first, then notarised and stapled here, and only then packed.
#
# It needs a credential stored once, with an app-specific password created at
# appleid.apple.com under "Sign-In and Security → App-Specific Passwords":
#
#   xcrun notarytool store-credentials hippocampus \
#     --apple-id YOU@EXAMPLE.COM --team-id YOURTEAM
#
# Leave --password out and it is asked for without echoing, so it never lands
# in the shell's history. It lives in the Keychain, never here.
set -e
cd "$(dirname "$0")/.."

PROFILE="${HIPPOCAMPUS_NOTARY_PROFILE:-hippocampus}"

if ! xcrun notarytool history --keychain-profile "$PROFILE" >/dev/null 2>&1; then
  cat <<END
Could not find the credential "$PROFILE" in the Keychain.

Store it once, with an app-specific password created at appleid.apple.com:

  xcrun notarytool store-credentials $PROFILE --apple-id YOU@EXAMPLE.COM --team-id YOURTEAM

In the meantime the signed app keeps working on your own machine.
END
  exit 1
fi

IDENTITY=$(security find-identity -v -p codesigning | sed -n 's/.*"\(Developer ID Application:[^"]*\)".*/\1/p' | head -1)
[ -n "$IDENTITY" ] || { echo "no Developer ID Application identity in the Keychain"; exit 1; }

VERSION=$(node -p "require('./package.json').version")
APP=release/mac-arm64/Hippocampus.app
OUT=release/v$VERSION
DMG="Hippocampus-arm64.dmg"
ZIP="Hippocampus-$VERSION-arm64-mac.zip"
rm -rf "$OUT" && mkdir -p "$OUT"

echo "==> building the helpers and the app, signed"
npm run build:native
npm run dist

echo "==> notarising the app (usually a few minutes)"
ditto -c -k --keepParent "$APP" "$OUT/notarize.zip"
xcrun notarytool submit "$OUT/notarize.zip" --keychain-profile "$PROFILE" --wait
rm "$OUT/notarize.zip"
# Stapling is what lets the app open without internet: without the staple,
# Gatekeeper has to ask Apple on every first open.
xcrun stapler staple "$APP"
spctl --assess --type execute -v "$APP"

echo "==> the disk image people download"
STAGE=$(mktemp -d)
ditto "$APP" "$STAGE/Hippocampus.app"
ln -s /Applications "$STAGE/Applications"
hdiutil create -volname Hippocampus -srcfolder "$STAGE" -ov -format UDZO "$OUT/$DMG" >/dev/null
rm -rf "$STAGE"
codesign --sign "$IDENTITY" --timestamp "$OUT/$DMG"
xcrun notarytool submit "$OUT/$DMG" --keychain-profile "$PROFILE" --wait
xcrun stapler staple "$OUT/$DMG"
spctl --assess --type open --context context:primary-signature -v "$OUT/$DMG"

echo "==> the update the app downloads by itself"
ditto -c -k --sequesterRsrc --keepParent "$APP" "$OUT/$ZIP"
node scripts/update-manifest.mjs "$OUT" "$VERSION" "$ZIP" "$DMG" > "$OUT/latest-mac.yml"

echo
echo "ready, in $OUT — attach all three to the v$VERSION release:"
ls -1 "$OUT"
