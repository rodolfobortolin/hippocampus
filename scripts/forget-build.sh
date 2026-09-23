#!/bin/sh
# Takes the app just built in release/ out of Launch Services.
#
# macOS registers every Hippocampus.app it sees, and the login items resolve
# by bundle identifier. A build left registered inside the repository — in
# ~/Documents, which launchd cannot read — took the agents with it: on 23
# September the collector, the focus helper and the wake-word listener stopped
# at 17:08, the minute a build was made, still reported as "on" by
# SMAppService, until they were registered again from /Applications. An old
# build of the pre-rename repository was registered the same way, and is the
# likely cause of the same stop on 20 September.
LSREGISTER=/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister
cd "$(dirname "$0")/.."
[ -d release/mac-arm64/Hippocampus.app ] && "$LSREGISTER" -u "$PWD/release/mac-arm64/Hippocampus.app" 2>/dev/null
exit 0
