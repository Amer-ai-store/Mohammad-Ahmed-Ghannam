#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
: "${ANDROID_HOME:?Android SDK missing}"
platform="$ANDROID_HOME/platforms/android-35/android.jar"
[[ -f "$platform" ]] || { echo 'Android API 35 required'; exit 1; }
bt="$(find "$ANDROID_HOME/build-tools" -mindepth 1 -maxdepth 1 -type d | sort -V | tail -n 1)"
[[ -x "$bt/aapt2" && -x "$bt/d8" && -x "$bt/apksigner" ]]
mkdir -p build/classes build/dex dist
"$bt/aapt2" link -I "$platform" --manifest AndroidManifest.xml -o build/unsigned.apk
javac -source 8 -target 8 -bootclasspath "$platform" -d build/classes MainActivity.java
"$bt/d8" --min-api 24 --lib "$platform" --output build/dex $(find build/classes -name '*.class')
zip -j build/unsigned.apk build/dex/classes.dex
"$bt/zipalign" -f 4 build/unsigned.apk build/aligned.apk
keytool -genkeypair -keystore build/preview.jks -storepass android -keypass android -alias preview -keyalg RSA -keysize 2048 -validity 30 -dname 'CN=Amir preview only' >/dev/null 2>&1
"$bt/apksigner" sign --ks build/preview.jks --ks-key-alias preview --ks-pass pass:android --key-pass pass:android --out dist/Amir-AI-Store-preview.apk build/aligned.apk
"$bt/apksigner" verify --verbose dist/Amir-AI-Store-preview.apk
"$bt/aapt2" dump badging dist/Amir-AI-Store-preview.apk | sed -n '1,8p'
sha256sum dist/Amir-AI-Store-preview.apk > dist/SHA256SUMS.txt
echo AMIR_ANDROID_PREVIEW_BUILD_OK
