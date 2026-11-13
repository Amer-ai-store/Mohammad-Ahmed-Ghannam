# Video Vault — Android (Compose + Media3)

Arabic-first local-media library and player. **Separate from Jawafa ERP / Store.** No access to financial systems, no user credentials, no network permission and no DRM circumvention.

## Android build

Requires JDK 17, Android SDK 35, Gradle 8.9 (the GitHub workflow installs these).

```bash
cd apps/video-vault
gradle :app:testDebugUnitTest :app:assembleDebug --no-daemon
```

Debug APK: `app/build/outputs/apk/debug/app-debug.apk`.

## Usage

- Add files through Android's document picker. Their URIs are stored with persistable read grants.
- Search by title, channel, or import date. Toggle ♥ to save favorites.
- Tap a video for native Media3 playback, pause/seek, speed 0.5–2x and volume controls.
- Import external .srt or .vtt by selecting its language first; use the subtitle dropdown for seven languages or Off.
- Select built-in audio streams, or supply an external audio recording for one of the supported languages. External audio is merged with the video; **timing synchronization depends on file alignment**.
- Last played time and position are saved in Room and shown in Recently Watched. Video file removal from the library does not delete the original file.

## Important boundaries

FapHouse and other paywalled video-page URLs are not downloadable media URLs. This Android player is for media files provided locally, and does not bypass DRM, CAPTCHAs, authorization, paid access, or licensing. No credentials are collected. Do not report successful download of any particular protected title unless a real permitted end-to-end download has been verified.

## Testing scope

Unit and Room query tests run in GitHub Actions. An Android emulator or physical device acceptance run is still required to validate codecs, SRT/VTT rendering, player-track switching, external dubbed-audio alignment, and a final APK install. The test inventory records implemented features separately from tests actually run.
