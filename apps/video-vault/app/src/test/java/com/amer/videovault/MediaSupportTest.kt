package com.amer.videovault

import org.junit.Assert.*
import org.junit.Test

class MediaSupportTest {
    @Test fun sevenLanguagesExist() = assertEquals(7, SubtitleLanguage.entries.size)
    @Test fun japaneseSupported() = assertNotNull(SubtitleLanguage.fromCode("ja"))
    @Test fun chineseSupported() = assertNotNull(SubtitleLanguage.fromCode("zh"))
    @Test fun koreanSupported() = assertNotNull(SubtitleLanguage.fromCode("ko"))
    @Test fun arabicSupported() = assertNotNull(SubtitleLanguage.fromCode("ar"))
    @Test fun englishSupported() = assertNotNull(SubtitleLanguage.fromCode("en"))
    @Test fun spanishSupported() = assertNotNull(SubtitleLanguage.fromCode("es"))
    @Test fun frenchSupported() = assertNotNull(SubtitleLanguage.fromCode("fr"))
    @Test fun unknownLanguageRejected() = assertNull(SubtitleLanguage.fromCode("xx"))
    @Test fun srtSubtitleDetected() = assertEquals("application/x-subrip", MediaSupport.subtitleMime("movie.SRT"))
    @Test fun vttSubtitleDetected() = assertEquals("text/vtt", MediaSupport.subtitleMime("movie.vtt"))
    @Test fun invalidSubtitleRejected() = assertNull(MediaSupport.subtitleMime("sample.exe"))
    @Test fun speedClampedBelowHalf() = assertEquals(0.5f, MediaSupport.clampSpeed(-2f), 0.0001f)
    @Test fun speedClampedAboveDouble() = assertEquals(2f, MediaSupport.clampSpeed(6f), 0.0001f)
    @Test fun speedPreservedInRange() = assertEquals(1.25f, MediaSupport.clampSpeed(1.25f), 0.0001f)
    @Test fun timestampsFormatted() = assertEquals("01:01:01", MediaSupport.displayTime(3_661_000))
    @Test fun negativeDurationHandled() = assertEquals("00:00", MediaSupport.displayTime(-500))
    @Test fun dateFormattingValid() = assertTrue(Regex("\\d{4}-\\d{2}-\\d{2}").matches(MediaSupport.importDate(0)))
    private fun sample() = LocalVideo(
        uri = "content://videos/sample", title = "Example Film", channel = "Documentaries",
        importedDate = "2026-11-13", importedAt = 100L
    )
    @Test fun titleSearch() = assertTrue(MediaSupport.matches(sample(), "Film"))
    @Test fun channelSearch() = assertTrue(MediaSupport.matches(sample(), "documentaries"))
    @Test fun dateSearch() = assertTrue(MediaSupport.matches(sample(), "2026-11"))
    @Test fun unrelatedSearchRejected() = assertFalse(MediaSupport.matches(sample(), "weather"))
}
