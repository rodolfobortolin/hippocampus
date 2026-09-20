#!/bin/sh
# Notarises the app and staples the ticket to the .dmg.
#
# Signing with a Developer ID is enough for your own machine. Notarisation only
# matters when someone else downloads it: Gatekeeper refuses, on first open, a
# Developer ID app Apple has never seen — signed, intact, and still refused.
#
# It needs a credential stored once:
#
#   xcrun notarytool store-credentials hippocampus \
#     --apple-id YOU@EXAMPLE.COM --team-id YOURTEAM --password APP-SPECIFIC-PASSWORD
#
# The app-specific password is not your Apple ID password: it is generated at
# appleid.apple.com, under "Security → App-Specific Passwords". It lives in the
# Keychain, never here.
set -e
cd "$(dirname "$0")/.."

PROFILE="${HIPPOCAMPUS_NOTARY_PROFILE:-hippocampus}"

if ! xcrun notarytool history --keychain-profile "$PROFILE" >/dev/null 2>&1; then
  cat <<END
Could not find the credential "$PROFILE" in the Keychain.

Store it once, with an app-specific password created at appleid.apple.com:

  xcrun notarytool store-credentials $PROFILE \\
    --apple-id YOU@EXAMPLE.COM --team-id YOURTEAM --password APP-SPECIFIC-PASSWORD

In the meantime the signed app keeps working on your own machine.
END
  exit 1
fi

echo "==> building and signing"
npm run build
npx electron-builder --mac --arm64 -c.mac.target=dmg

DMG=$(ls -t release/*.dmg 2>/dev/null | head -1)
[ -n "$DMG" ] || { echo "no .dmg found in release/"; exit 1; }

echo "==> submitting $DMG to Apple (usually a few minutes)"
xcrun notarytool submit "$DMG" --keychain-profile "$PROFILE" --wait

# Stapling is what lets the app open without internet: without the staple,
# Gatekeeper has to ask Apple on every first open.
echo "==> stapling the ticket"
xcrun stapler staple "$DMG"

echo "==> checking how Gatekeeper will see it"
spctl --assess --type open --context context:primary-signature -v "$DMG"
xcrun stapler validate "$DMG"

echo
echo "ready: $DMG"
