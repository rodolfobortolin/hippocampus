#!/bin/sh
# Generates the .icns, the menu bar icons and the brand mark from the art in
# assets/. Run it once; the result lands in build/ and public/, which git ignores.
set -e
cd "$(dirname "$0")/.."
python3 scripts/icons.py
rm -rf build/hippocampus.iconset && mkdir -p build/hippocampus.iconset
python3 - <<'PY'
from PIL import Image
m = Image.open('build/icon-1024.png')
for side, name in [(16,'icon_16x16'),(32,'icon_16x16@2x'),(32,'icon_32x32'),(64,'icon_32x32@2x'),
                   (128,'icon_128x128'),(256,'icon_128x128@2x'),(256,'icon_256x256'),
                   (512,'icon_256x256@2x'),(512,'icon_512x512'),(1024,'icon_512x512@2x')]:
    m.resize((side, side), Image.LANCZOS).save(f'build/hippocampus.iconset/{name}.png')
PY
iconutil -c icns build/hippocampus.iconset -o build/hippocampus.icns
cp build/hippocampus.icns build/icon.icns
# The opening video loses its audio: an app that makes noise every time it
# opens is an app people turn off. Without audio it is also smaller.
if [ -f assets/intro.mp4 ]; then
  ffmpeg -v quiet -y -i assets/intro.mp4 -an -movflags +faststart -c:v copy public/intro.mp4
  echo "opening ready"
fi

echo "icons ready"
