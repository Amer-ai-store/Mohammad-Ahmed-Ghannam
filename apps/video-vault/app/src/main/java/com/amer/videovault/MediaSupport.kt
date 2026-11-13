package com.amer.videovault

import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

enum class SubtitleLanguage(val code: String, val label: String) {
    JAPANESE("ja", "اليابانية"),
    CHINESE("zh", "الصينية"),
    KOREAN("ko", "الكورية"),
    ARABIC("ar", "العربية"),
    ENGLISH("en", "الإنجليزية"),
    SPANISH("es", "الإسبانية"),
    FRENCH("fr", "الفرنسية");

    companion object {
        fun fromCode(code: String?): SubtitleLanguage? = entries.firstOrNull { it.code == code }
    }
}

object MediaSupport {
    fun subtitleMime(filename: String?): String? = when {
        filename?.lowercase(Locale.ROOT)?.endsWith(".srt") == true -> "application/x-subrip"
        filename?.lowercase(Locale.ROOT)?.endsWith(".vtt") == true -> "text/vtt"
        else -> null
    }

    fun clampSpeed(speed: Float): Float = speed.coerceIn(0.5f, 2.0f)

    fun displayTime(ms: Long): String {
        val seconds = (ms.coerceAtLeast(0) / 1000)
        val hours = seconds / 3600
        val minutes = (seconds % 3600) / 60
        val remaining = seconds % 60
        return if (hours > 0) "%02d:%02d:%02d".format(Locale.ROOT, hours, minutes, remaining)
            else "%02d:%02d".format(Locale.ROOT, minutes, remaining)
    }

    fun importDate(epochMillis: Long): String =
        DateTimeFormatter.ISO_LOCAL_DATE.withZone(ZoneId.systemDefault()).format(Instant.ofEpochMilli(epochMillis))

    fun matches(video: LocalVideo, text: String): Boolean {
        val term = text.trim()
        return term.isEmpty() || video.title.contains(term, true) ||
            video.channel.contains(term, true) || video.importedDate.contains(term, true)
    }
}
