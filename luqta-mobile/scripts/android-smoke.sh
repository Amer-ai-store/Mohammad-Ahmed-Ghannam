#!/usr/bin/env bash
# Opens the installed release build on a running emulator in both designs and fails when the app dies or Android
# records a crash for it. Used by .github/workflows/luqta-android-smoke.yml; screenshots go to $SMOKE_SHOTS.
set -u
PKG="${PKG:-com.luqta.store}"
APK="${APK:-android/app/build/outputs/apk/release/app-release.apk}"
shots="${SMOKE_SHOTS:-./smoke-shots}"
mkdir -p "$shots"
failed=0

for scale in window_animation_scale transition_animation_scale animator_duration_scale; do adb shell settings put global "$scale" 0; done
adb shell input keyevent 82 || true
adb install -r "$APK"
adb logcat -c

check() {
  sleep 20
  adb exec-out screencap -p > "$shots/$1.png" || true
  if [ -z "$(adb shell pidof "$PKG" | tr -d '\r')" ]; then echo "::error::The app closed during: $1"; failed=1; fi
  if adb logcat -d -b crash | grep -q "$PKG"; then echo "::error::Android recorded a crash during: $1"; failed=1; fi
  echo "checked: $1"
}
open_link() { adb shell am start -W -a android.intent.action.VIEW -d "$1" "$PKG" > /dev/null; }
relaunch() { adb shell am force-stop "$PKG"; adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 > /dev/null; }

relaunch;                                       check classic-home
open_link 'luqta://appearance?design=rafiq';    check rafiq-appearance
open_link 'luqta:///';                          check rafiq-home
relaunch;                                       check rafiq-home-after-restart
adb shell wm density 480; relaunch;             check rafiq-home-360dp
adb shell wm density 380; relaunch;             check rafiq-home-454dp
adb shell wm density reset
open_link 'luqta://appearance?design=classic';  check classic-appearance
open_link 'luqta:///';                          check classic-home-again

if [ "$failed" != 0 ]; then
  echo "----- crash buffer -----"; adb logcat -d -b crash | tail -n 200
  echo "----- errors -----"; adb logcat -d '*:E' | grep -iE "$PKG|ReactNative|AndroidRuntime|RNSVG" | tail -n 200
  exit 1
fi
echo "The app stayed open in every step."
