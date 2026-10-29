#!/usr/bin/env bash
# Records the Shotrova cold launch on the connected Android device and
# pulls the resulting video into test-reports/device/launch-cold.mp4.
# Best effort: a missing or unpullable recording must never fail the run,
# because the device tests themselves do not depend on it.
set -u
ADB=adb
command -v adb >/dev/null || ADB="${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}/platform-tools/adb"
mkdir -p test-reports/device
"$ADB" shell screenrecord --time-limit 25 /sdcard/shotrova-launch.mp4 &
for _ in $(seq 1 10); do
  if "$ADB" shell test -s /sdcard/shotrova-launch.mp4 2>/dev/null; then break; fi
  sleep 1
done
"$ADB" shell am start -W -n io.github.firatnexus.shotrova.debug/io.github.firatnexus.shotrova.MainActivity
sleep 8
"$ADB" shell 'kill -INT $(pidof screenrecord) 2>/dev/null' || true
for _ in $(seq 1 10); do
  "$ADB" shell 'pidof screenrecord >/dev/null' 2>/dev/null || break
  sleep 1
done
if "$ADB" shell test -s /sdcard/shotrova-launch.mp4 2>/dev/null; then
  "$ADB" pull /sdcard/shotrova-launch.mp4 test-reports/device/launch-cold.mp4 || echo "launch recording could not be pulled"
else
  echo "launch recording was not created"
fi
"$ADB" shell rm -f /sdcard/shotrova-launch.mp4 || true
