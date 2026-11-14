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
open_link 'luqta://cart?add=milk*2,bread*1';    check shared-cart-link
open_link 'luqta://appearance?design=classic';  check classic-appearance
open_link 'luqta:///';                          check classic-home-again

if [ "$failed" != 0 ]; then
  echo "----- crash buffer -----"; adb logcat -d -b crash | tail -n 200
  echo "----- errors -----"; adb logcat -d '*:E' | grep -iE "$PKG|ReactNative|AndroidRuntime|RNSVG" | tail -n 200
  exit 1
fi
echo "The app stayed open in every step."

# ----- Performance (reported, not enforced yet) -----
# The emulator draws with a software GPU, so absolute numbers are slower than a phone; compare them between runs.
summary="${GITHUB_STEP_SUMMARY:-/dev/null}"
component="$(adb shell cmd package resolve-activity --brief -c android.intent.category.LAUNCHER "$PKG" | tail -n 1 | tr -d '\r')"
read -r width height < <(adb shell wm size | awk -F'[ x]' '/Physical size/ {print $3, $4}')
starts=(); jsstarts=()
for run in 1 2 3; do
  adb logcat -c
  total="$(adb shell am start -W -S -n "$component" | awk -F': ' '/TotalTime/ {print $2}' | tr -d '\r')"
  starts+=("${total:-0}")
  # From the launch intent to React Native running the app ("Running \"main\"" is logged in release builds too).
  js=""
  for _ in $(seq 1 60); do
    js="$(adb logcat -d -v epoch -s ActivityTaskManager:I ReactNativeJS:I | awk -v pkg="$PKG" '
      $0 ~ "START u0" && $0 ~ pkg && !t0 { t0 = $1 }
      /Running "main"/ && t0 { printf "%d", ($1 - t0) * 1000; exit }')"
    [ -n "$js" ] && break
    sleep 0.5
  done
  jsstarts+=("${js:-0}")
  sleep 15
done
median() { printf '%s\n' "$@" | sort -n | awk '{a[NR]=$1} END {print a[int((NR+1)/2)]}'; }

# Smoothness and memory on the home screen after it has settled, in each design.
measure_home() {
  local name="$1"
  sleep 20
  adb shell dumpsys gfxinfo "$PKG" reset > /dev/null
  for _ in 1 2 3 4; do
    adb shell input swipe $((width / 2)) $((height * 3 / 4)) $((width / 2)) $((height / 4)) 250; sleep 0.6
  done
  for _ in 1 2 3 4; do
    adb shell input swipe $((width / 2)) $((height / 4)) $((width / 2)) $((height * 3 / 4)) 250; sleep 0.6
  done
  local gfx; gfx="$(adb shell dumpsys gfxinfo "$PKG" | tr -d '\r')"
  local frames janky p90 p99 pss
  frames="$(awk -F': *' '/Total frames rendered/ {print $2; exit}' <<<"$gfx")"
  janky="$(awk -F': *' '/Janky frames:/ {print $2; exit}' <<<"$gfx")"
  p90="$(awk -F': *' '/^ *90th percentile/ {print $2; exit}' <<<"$gfx")"
  p99="$(awk -F': *' '/^ *99th percentile/ {print $2; exit}' <<<"$gfx")"
  pss="$(adb shell dumpsys meminfo "$PKG" | tr -d '\r' | awk '/TOTAL PSS:/ {print int($3 / 1024); exit}')"
  echo "| $name | ${frames:-?} | ${janky:-?} | ${p90:-?} | ${p99:-?} | ${pss:-?} MB |" >> "$summary"
  echo "perf $name: frames=${frames:-?} janky=${janky:-?} p90=${p90:-?} p99=${p99:-?} pss=${pss:-?}MB"
}

bundle_kb="$(unzip -l "$APK" | awk '/assets\/index.android.bundle/ {print int($1 / 1024)}')"
apk_mb="$(du -m "$APK" | cut -f1)"
{
  echo "## Luqta performance on the emulator"
  echo
  echo "| Measure | Value |"
  echo "|---|---|"
  echo "| Cold start to first native frame (TotalTime, median of 3) | $(median "${starts[@]}") ms (${starts[*]}) |"
  echo "| Cold start to React Native running the app (median of 3) | $(median "${jsstarts[@]}") ms (${jsstarts[*]}) |"
  echo "| JavaScript bundle in the APK | ${bundle_kb:-?} KB |"
  echo "| APK for this emulator (x86_64 only) | ${apk_mb:-?} MB |"
  echo
  echo "| Home screen, 8 swipes | Frames | Janky frames | 90th pct | 99th pct | Memory (PSS) |"
  echo "|---|---|---|---|---|---|"
} >> "$summary"
echo "perf cold starts (ms): ${starts[*]}; to React Native: ${jsstarts[*]}; bundle ${bundle_kb:-?} KB; apk ${apk_mb:-?} MB"

relaunch; measure_home classic
open_link 'luqta://appearance?design=rafiq'; open_link 'luqta:///'; measure_home rafiq
open_link 'luqta://appearance?design=classic'
if adb logcat -d -b crash | grep -q "$PKG"; then echo "::error::Android recorded a crash while measuring"; exit 1; fi
