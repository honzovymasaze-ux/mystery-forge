#!/usr/bin/env bash
# Build the TV app (tv-app/) around one game's companion page.
#   scripts/build-tv-apk.sh "<path to the player companion .html>" "<game title>" [output.apk]
# Use the player companion (forge render writes it next to the companion page): it has the evidence archive and no
# readable solution. The app serves it to the phones on the same Wi-Fi, see tv-app/.../GameServer.java.
# Needs Java 17+ and the Android SDK (ANDROID_HOME). The APK installs on Android TV, Google TV, and phones by sideload.
set -euo pipefail
companion="$1"
title="${2:-Detektivka}"
here="$(cd "$(dirname "$0")/.." && pwd)"
out="$(realpath -m "${3:-$here/$title.apk}")"
# One application id per game, so several games can sit on one TV side by side.
slug="$(python3 -c 'import sys, unicodedata, re; t = unicodedata.normalize("NFKD", sys.argv[1]).encode("ascii", "ignore").decode().lower(); print(re.sub("[^a-z0-9]+", "_", t).strip("_"))' "$title")"
mkdir -p "$here/tv-app/app/src/main/assets"
cp "$companion" "$here/tv-app/app/src/main/assets/pruvodce.html"
# The recordings that forge render writes next to the player companion (render/media/), served as media/<name>.
rm -rf "$here/tv-app/app/src/main/assets/media"
if [ -d "$(dirname "$companion")/media" ]; then
  cp -r "$(dirname "$companion")/media" "$here/tv-app/app/src/main/assets/media"
fi
cd "$here/tv-app"
echo "sdk.dir=${ANDROID_HOME:?Set ANDROID_HOME to the Android SDK folder}" > local.properties
printf '%s' "$title" > build-title.txt
gradle --quiet assembleDebug -PgameTitleFile="$PWD/build-title.txt" -PgameId="cz.detektivka.tv.${slug:-hra}"
cp app/build/outputs/apk/debug/app-debug.apk "$out"
echo "$out"
