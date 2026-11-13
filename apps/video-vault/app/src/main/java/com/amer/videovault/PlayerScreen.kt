package com.amer.videovault

import android.app.Activity
import android.content.pm.ActivityInfo
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.annotation.OptIn
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.TrackGroup
import androidx.media3.common.TrackSelectionOverride
import androidx.media3.common.Tracks
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.exoplayer.source.MergingMediaSource
import androidx.media3.ui.PlayerView
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import java.util.Locale

data class AudioTrackChoice(val group: TrackGroup, val index: Int, val label: String)

@OptIn(UnstableApi::class)
@Composable
fun PlayerScreen(video: LocalVideo, vm: VideoVaultViewModel, onBack: () -> Unit) {
    val context = LocalContext.current
    val activity = context as? Activity
    val player = remember(video.uri) { ExoPlayer.Builder(context).build() }
    val subtitles by remember(video.uri) { vm.subtitles(video.uri) }.collectAsState(initial = emptyList())
    val dubbedTracks by remember(video.uri) { vm.dubbedAudios(video.uri) }.collectAsState(initial = emptyList())
    val subtitleLanguage by vm.selectedSubtitleLanguage.collectAsState()
    var addingSubtitleLanguage by remember { mutableStateOf("ar") }
    var addingAudioLanguage by remember { mutableStateOf("ar") }
    var activeDub by remember(video.uri) { mutableStateOf<String?>(null) }

    var audioChoices by remember(video.uri) { mutableStateOf(emptyList<AudioTrackChoice>()) }
    var audioMenuExpanded by remember { mutableStateOf(false) }
    var subtitlesMenuExpanded by remember { mutableStateOf(false) }
    var dubbedMenuExpanded by remember { mutableStateOf(false) }
    var importLanguageMenu by remember { mutableStateOf(false) }
    var importAudioLanguageMenu by remember { mutableStateOf(false) }
    var isPlaying by remember { mutableStateOf(false) }
    var playbackError by remember { mutableStateOf<String?>(null) }
    var currentPosition by remember { mutableLongStateOf(video.progressMs) }
    var currentDuration by remember { mutableLongStateOf(video.durationMs) }
    var playbackSpeed by remember { mutableFloatStateOf(1f) }
    var volume by remember { mutableFloatStateOf(1f) }
    var scrubbing by remember { mutableStateOf(false) }
    var scrubValue by remember { mutableFloatStateOf(0f) }
    var initialized by remember(video.uri) { mutableStateOf(false) }
    var landscape by remember { mutableStateOf(false) }

    val addSubtitlePicker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) vm.addSubtitle(video.uri, addingSubtitleLanguage, uri)
    }
    val addAudioPicker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) vm.addDubbedAudio(video.uri, addingAudioLanguage, uri)
    }

    DisposableEffect(player) {
        val listener = object : Player.Listener {
            override fun onTracksChanged(tracks: Tracks) {
                audioChoices = buildList {
                    for ((groupNumber, group) in tracks.groups.withIndex()) {
                        if (group.type != C.TRACK_TYPE_AUDIO) continue
                        for (i in 0 until group.length) {
                            if (!group.isTrackSupported(i)) continue
                            val format = group.getTrackFormat(i)
                            val label = format.label?.takeIf { it.isNotBlank() }
                                ?: format.language?.takeIf { it.isNotBlank() }
                                ?: "مسار صوت ${groupNumber + 1} / ${i + 1}"
                            add(AudioTrackChoice(group.mediaTrackGroup, i, label))
                        }
                    }
                }
            }
            override fun onIsPlayingChanged(playing: Boolean) { isPlaying = playing }
            override fun onPlayerError(error: PlaybackException) {
                playbackError = "فشل تشغيل الملف: ${error.errorCodeName}"
            }
        }
        player.addListener(listener)
        onDispose {
            vm.saveProgress(video.uri, player.currentPosition, player.duration)
            activity?.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
            player.removeListener(listener)
            player.release()
        }
    }

    LaunchedEffect(video.uri, subtitles, subtitleLanguage, dubbedTracks, activeDub) {
        val previouslyPlaying = if (initialized) player.playWhenReady else true
        val resumeAt = if (initialized) player.currentPosition.coerceAtLeast(0) else video.progressMs
        val subtitle = subtitles.firstOrNull { it.language == subtitleLanguage }
        val mediaItem = MediaItem.Builder().setUri(Uri.parse(video.uri)).apply {
            if (subtitle != null) {
                setSubtitleConfigurations(
                    listOf(
                        MediaItem.SubtitleConfiguration.Builder(Uri.parse(subtitle.uri))
                            .setMimeType(subtitle.mimeType)
                            .setLanguage(subtitle.language)
                            .setSelectionFlags(C.SELECTION_FLAG_DEFAULT)
                            .build()
                    )
                )
            }
        }.build()
        playbackError = null
        val dubbedAudio = dubbedTracks.firstOrNull { it.language == activeDub }
        if (dubbedAudio == null) {
            player.setMediaItem(mediaItem, resumeAt)
        } else {
            val factory = DefaultMediaSourceFactory(context)
            val mainSource = factory.createMediaSource(mediaItem)
            val audioSource = factory.createMediaSource(MediaItem.fromUri(Uri.parse(dubbedAudio.uri)))
            player.setMediaSource(MergingMediaSource(true, true, mainSource, audioSource), resumeAt)
        }
        player.prepare()
        player.playWhenReady = previouslyPlaying
        player.setPlaybackSpeed(MediaSupport.clampSpeed(playbackSpeed))
        initialized = true
    }

    LaunchedEffect(player) {
        while (isActive) {
            currentPosition = player.currentPosition.coerceAtLeast(0)
            if (player.duration > 0) currentDuration = player.duration
            delay(400L)
        }
    }
    LaunchedEffect(player, video.uri) {
        while (isActive) {
            delay(5_000L)
            vm.saveProgress(video.uri, player.currentPosition, player.duration)
        }
    }

    val languages = SubtitleLanguage.entries
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            TextButton(onClick = {
                activity?.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
                onBack()
            }) { Text("العودة للمكتبة") }
            TextButton(onClick = {
                landscape = !landscape
                activity?.requestedOrientation = if (landscape)
                    ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
                    else ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
            }) { Text(if (landscape) "الوضع العادي" else "ملء الشاشة / تدوير") }
        }
        Text(video.title, style = MaterialTheme.typography.titleLarge)
        AndroidView(
            factory = { PlayerView(it).apply { useController = false; this.player = player } },
            update = { it.player = player },
            modifier = Modifier.fillMaxWidth().height(if (landscape) 360.dp else 230.dp)
        )
        playbackError?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = { if (player.isPlaying) player.pause() else player.play() }) {
                Text(if (isPlaying) "إيقاف مؤقت" else "تشغيل")
            }
            OutlinedButton(onClick = { player.seekTo((player.currentPosition - 10_000L).coerceAtLeast(0)) }) {
                Text("−10 ث")
            }
            OutlinedButton(onClick = { player.seekTo(player.currentPosition + 10_000L) }) {
                Text("+10 ث")
            }
        }
        val duration = currentDuration.coerceAtLeast(1L)
        val positionFraction = (currentPosition.toFloat() / duration).coerceIn(0f, 1f)
        Text("${MediaSupport.displayTime(currentPosition)} / ${MediaSupport.displayTime(currentDuration)}")
        Slider(
            value = if (scrubbing) scrubValue else positionFraction,
            onValueChange = { scrubbing = true; scrubValue = it },
            onValueChangeFinished = {
                player.seekTo((scrubValue * duration).toLong())
                scrubbing = false
            },
            modifier = Modifier.fillMaxWidth()
        )
        Text("سرعة العرض: ${"%.2f".format(Locale.ROOT, playbackSpeed)}x")
        Slider(value = playbackSpeed, onValueChange = {
            playbackSpeed = MediaSupport.clampSpeed(it)
            player.setPlaybackSpeed(playbackSpeed)
        }, valueRange = 0.5f..2.0f)

        Text("مستوى الصوت: ${(volume * 100).toInt()}%")
        Slider(value = volume, onValueChange = { volume = it; player.volume = it }, valueRange = 0f..1f)

        Text("الترجمة الخارجية", style = MaterialTheme.typography.titleMedium)
        Box {
            OutlinedButton(onClick = { subtitlesMenuExpanded = true }) {
                Text("لغة الترجمة: ${SubtitleLanguage.fromCode(subtitleLanguage)?.label ?: "إيقاف الترجمة"}")
            }
            DropdownMenu(expanded = subtitlesMenuExpanded, onDismissRequest = { subtitlesMenuExpanded = false }) {
                DropdownMenuItem(text = { Text("إيقاف الترجمة") }, onClick = {
                    vm.selectSubtitle(null); subtitlesMenuExpanded = false
                })
                languages.forEach { lang ->
                    val attached = subtitles.any { it.language == lang.code }
                    DropdownMenuItem(
                        text = { Text("${lang.label} ${if (attached) "✓" else "(لم يُرفق ملف)"}") },
                        onClick = { vm.selectSubtitle(lang.code); subtitlesMenuExpanded = false }
                    )
                }
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Box {
                OutlinedButton(onClick = { importLanguageMenu = true }) {
                    Text("لغة الملف: ${SubtitleLanguage.fromCode(addingSubtitleLanguage)?.label}")
                }
                DropdownMenu(expanded = importLanguageMenu, onDismissRequest = { importLanguageMenu = false }) {
                    languages.forEach { lang ->
                        DropdownMenuItem(text = { Text(lang.label) }, onClick = {
                            addingSubtitleLanguage = lang.code; importLanguageMenu = false
                        })
                    }
                }
            }
            Button(onClick = { addSubtitlePicker.launch(arrayOf("*/*")) }) {
                Text("إضافة SRT / VTT")
            }
        }
        Text("التبديل يعيد تحضير المشغّل عند نفس موضع العرض. لا تُنشأ ترجمة تلقائية.")
        subtitles.forEach { item ->
            TextButton(onClick = { vm.removeSubtitle(video.uri, item.language) }) {
                Text("إزالة ترجمة ${SubtitleLanguage.fromCode(item.language)?.label ?: item.language}")
            }
        }

        Text("المسارات الصوتية داخل الفيديو", style = MaterialTheme.typography.titleMedium)
        Box {
            OutlinedButton(onClick = { audioMenuExpanded = true }) {
                Text("اختر المسار الصوتي (${audioChoices.size})")
            }
            DropdownMenu(expanded = audioMenuExpanded, onDismissRequest = { audioMenuExpanded = false }) {
                if (audioChoices.isEmpty()) {
                    DropdownMenuItem(text = { Text("لا توجد مسارات متاحة") },
                        enabled = false, onClick = {})
                }
                audioChoices.forEach { choice ->
                    DropdownMenuItem(text = { Text(choice.label) }, onClick = {
                        player.trackSelectionParameters = player.trackSelectionParameters
                            .buildUpon()
                            .setOverrideForType(TrackSelectionOverride(choice.group, listOf(choice.index)))
                            .build()
                        audioMenuExpanded = false
                    })
                }
            }
        }

        Text("ملفات الدبلجة الصوتية الخارجية", style = MaterialTheme.typography.titleMedium)
        Box {
            OutlinedButton(onClick = { dubbedMenuExpanded = true }) {
                Text("دبلجة العرض: ${SubtitleLanguage.fromCode(activeDub)?.label ?: "الصوت الأصلي"}")
            }
            DropdownMenu(expanded = dubbedMenuExpanded, onDismissRequest = { dubbedMenuExpanded = false }) {
                DropdownMenuItem(text = { Text("الصوت الأصلي") }, onClick = {
                    activeDub = null; dubbedMenuExpanded = false
                })
                dubbedTracks.forEach { item ->
                    DropdownMenuItem(
                        text = { Text(SubtitleLanguage.fromCode(item.language)?.label ?: item.language) },
                        onClick = { activeDub = item.language; dubbedMenuExpanded = false }
                    )
                }
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Box {
                OutlinedButton(onClick = { importAudioLanguageMenu = true }) {
                    Text("لغة الصوت: ${SubtitleLanguage.fromCode(addingAudioLanguage)?.label}")
                }
                DropdownMenu(expanded = importAudioLanguageMenu,
                    onDismissRequest = { importAudioLanguageMenu = false }) {
                    languages.forEach { lang ->
                        DropdownMenuItem(text = { Text(lang.label) }, onClick = {
                            addingAudioLanguage = lang.code; importAudioLanguageMenu = false
                        })
                    }
                }
            }
            Button(onClick = { addAudioPicker.launch(arrayOf("audio/*")) }) {
                Text("إضافة صوت خارجي")
            }
        }
        dubbedTracks.forEach { item ->
            TextButton(onClick = {
                if (activeDub == item.language) activeDub = null
                vm.removeDubbedAudio(video.uri, item.language)
            }) {
                Text("إزالة دبلجة ${SubtitleLanguage.fromCode(item.language)?.label ?: item.language}")
            }
        }
        Text("ملاحظة: هذه الميزة تشغّل ملف دبلجة يقدمه المستخدم؛ توليد دبلجة آلية غير متوفر. يجب توافق التوقيت والمدد.")
    }
}
