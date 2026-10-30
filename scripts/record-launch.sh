#!/usr/bin/env bash
# Records the Shotrova cold launch on the connected Android device and pulls
# the resulting videos into test-reports/device/. One launch is recorded in
# light mode and one in night mode, so the splash hand-off can be inspected
# frame by frame in both themes. Also captures the ShotrovaLaunch logcat
# trace so the recorded video can be correlated with the exact code path
# (signals vs timeout) that released the splash.
# Best effort: a missing or unpullable recording must never fail the run,
# because the device tests themselves do not depend on it.
set -u
ADB=adb
command -v adb >/dev/null || ADB="${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}/platform-tools/adb"
APP=io.github.firatnexus.shotrova.debug
ACT=io.github.firatnexus.shotrova.MainActivity
mkdir -p test-reports/device

record_launch() { # $1 = output name, $2 = settle seconds
  local out="$1" settle="$2" dev="/sdcard/shotrova-launch.mp4"
  "$ADB" shell rm -f "$dev" || true
  "$ADB" shell screenrecord --time-limit 45 "$dev" &
  for _ in $(seq 1 10); do
    if "$ADB" shell test -s "$dev" 2>/dev/null; then break; fi
    sleep 1
  done
  "$ADB" shell am start -W -n "$APP/$ACT"
  # The software-rendered CI emulator can take well over 10s to composite the
  # web launch screen; give the whole hand-off time to appear in the recording.
  sleep "$settle"
  "$ADB" shell 'kill -INT $(pidof screenrecord) 2>/dev/null' || true
  for _ in $(seq 1 10); do
    "$ADB" shell 'pidof screenrecord >/dev/null' 2>/dev/null || break
    sleep 1
  done
  if "$ADB" shell test -s "$dev" 2>/dev/null; then
    "$ADB" pull "$dev" "test-reports/device/$out" || echo "$out could not be pulled"
  else
    echo "$out was not created"
  fi
  "$ADB" shell rm -f "$dev" || true
}

# Fresh logcat so the trace covers exactly the recorded launch window.
"$ADB" logcat -c || true

# Light (default) cold launch.
record_launch launch-cold.mp4 20

# Night-mode cold launch: force dark UI, restart the app process so the
# launch path (splash background, WebView background) runs in dark theme.
"$ADB" shell cmd uimode night yes || true
"$ADB" shell am force-stop "$APP" || true
sleep 2
record_launch launch-night.mp4 15
"$ADB" shell cmd uimode night no || true

# The launch trace (which signal released the splash, and when) alongside
# the web layer's console output for the same launches.
"$ADB" logcat -d -v time 2>/dev/null | grep -E "ShotrovaLaunch|Capacitor/Console|chromium.*CONSOLE" \
  > test-reports/device/logcat-launch.txt || true
