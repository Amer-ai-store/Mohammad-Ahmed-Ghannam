# 20 implemented features — test evidence tracking

Scope: local files selected by their owner (not downloading protected online videos).

| # | Feature | Code | Automated verification |
|---|---|---|---|
|1|SAF multi-video import|ViewModel + LibraryScreen|Build only; device pending|
|2|Persistable local-file read grants|ViewModel|Build only; device pending|
|3|Room SQLite catalog|VideoStore|Robolectric importsLocalVideos|
|4|Search title|DAO + LibraryScreen|Robolectric searchByTitle|
|5|Search channel|DAO + LibraryScreen|Robolectric searchByChannel|
|6|Search date|DAO + LibraryScreen|Robolectric searchByDate|
|7|Favorite heart toggle|DAO + LibraryScreen|Robolectric favoritesCanBeToggledBothWays|
|8|Favorites filter|DAO + LibraryScreen|Robolectric favoritesOnlyFilter|
|9|Recently watched list|DAO + LibraryScreen|Robolectric recentlyWatchedSortedByTimestamp|
|10|Progress saving and resume|DAO + PlayerScreen|Robolectric progressAndDurationSaved; device pending|
|11|Local ExoPlayer|PlayerScreen|Build only; device pending|
|12|Play/pause controls|PlayerScreen|Build only; device pending|
|13|Seek and ±10s|PlayerScreen|Build only; device pending|
|14|Speed 0.5x–2x slider|PlayerScreen + MediaSupport|JUnit speedClamped...; device pending|
|15|Available audio-track selector|PlayerScreen|Build only; device pending|
|16|External SRT|ViewModel + PlayerScreen|JUnit srtSubtitleDetected + Room srtSubtitleStored; device pending|
|17|External VTT|ViewModel + PlayerScreen|JUnit vttSubtitleDetected + Room vttSubtitleStored; device pending|
|18|Seven subtitles + Off menu|PlayerScreen + ViewModel|JUnit sevenLanguagesExist; device pending|
|19|External prerecorded dubbed audio|DAO + PlayerScreen|Room dubbedAudioStoredAndReplaced; alignment test pending|
|20|Landscape orientation toggle|PlayerScreen|Build only; device pending|

Extras: volume slider, offline local playback, edit channel, remove library entry without deleting file, duplicate-safe imports, changing/removing subtitle and dubbed-audio attachments.

**Status: code present only until CI and hardware checks pass.** No claim of APK, end-to-end FapHouse test or DRM bypass.
