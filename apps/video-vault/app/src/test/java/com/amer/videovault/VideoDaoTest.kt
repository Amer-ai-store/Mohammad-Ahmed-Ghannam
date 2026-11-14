package com.amer.videovault

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33])
class VideoDaoTest {
    private lateinit var db: VideoVaultDatabase
    private lateinit var dao: VideoDao
    private fun sample(id: String, title: String, channel: String, date: String, time: Long) =
        LocalVideo("content://videos/$id", title, channel, date, time)

    @Before fun setup() {
        db = Room.inMemoryDatabaseBuilder(
            ApplicationProvider.getApplicationContext<Context>(),
            VideoVaultDatabase::class.java
        ).allowMainThreadQueries().build()
        dao = db.videoDao()
    }
    @After fun closeDb() = db.close()

    @Test fun importsLocalVideos() = runBlocking {
        val v = sample("1", "Test Video", "TV", "2026-11-13", 1)
        dao.importVideo(v)
        assertEquals(v, dao.getVideo(v.uri))
    }

    @Test fun importingAgainPreservesFavoritesAndProgress() = runBlocking {
        val v = sample("1", "Test Video", "TV", "2026-11-13", 1)
        dao.importVideo(v); dao.toggleFavorite(v.uri)
        dao.saveProgress(v.uri, 9000, 20000, 88)
        dao.importVideo(v)
        assertTrue(dao.getVideo(v.uri)!!.isFavorite)
        assertEquals(9000L, dao.getVideo(v.uri)!!.progressMs)
    }

    @Test fun searchByTitle() = runBlocking {
        dao.importVideo(sample("1", "Tokyo Train", "Channel X", "2026-11-13", 1))
        dao.importVideo(sample("2", "Paris", "Channel Y", "2026-11-12", 2))
        assertEquals(1, dao.searchVideos("Tokyo", false).first().size)
    }
    @Test fun searchByChannel() = runBlocking {
        dao.importVideo(sample("1", "Tokyo Train", "Anime", "2026-11-13", 1))
        assertEquals(1, dao.searchVideos("Anime", false).first().size)
    }
    @Test fun searchByDate() = runBlocking {
        dao.importVideo(sample("1", "Tokyo Train", "Anime", "2026-11-13", 1))
        assertEquals(1, dao.searchVideos("2026-11", false).first().size)
    }
    @Test fun searchIsCaseInsensitive() = runBlocking {
        dao.importVideo(sample("1", "Tokyo Train", "Anime", "2026-11-13", 1))
        assertEquals(1, dao.searchVideos("tokyo", false).first().size)
    }
    @Test fun favoritesCanBeToggledBothWays() = runBlocking {
        val v = sample("1", "Movie", "Cinema", "2026-11-13", 1)
        dao.importVideo(v); dao.toggleFavorite(v.uri)
        assertTrue(dao.getVideo(v.uri)!!.isFavorite)
        dao.toggleFavorite(v.uri)
        assertFalse(dao.getVideo(v.uri)!!.isFavorite)
    }
    @Test fun favoritesOnlyFilter() = runBlocking {
        val a = sample("1", "Movie", "Cinema", "2026-11-13", 1)
        val b = sample("2", "Another", "Cinema", "2026-11-13", 2)
        dao.importVideo(a); dao.importVideo(b); dao.toggleFavorite(a.uri)
        assertEquals(a.uri, dao.searchVideos("", true).first().single().uri)
    }
    @Test fun recentlyWatchedSortedByTimestamp() = runBlocking {
        val a = sample("1", "One", "TV", "2026-11-13", 1)
        val b = sample("2", "Two", "TV", "2026-11-13", 2)
        dao.importVideo(a); dao.importVideo(b)
        dao.saveProgress(a.uri, 100, 1000, 55)
        dao.saveProgress(b.uri, 200, 1000, 99)
        assertEquals(listOf(b.uri, a.uri), dao.recentlyWatched().first().map { it.uri })
    }
    @Test fun neverPlayedVideoNotRecent() = runBlocking {
        dao.importVideo(sample("1", "Unplayed", "TV", "2026-11-13", 1))
        assertTrue(dao.recentlyWatched().first().isEmpty())
    }
    @Test fun progressAndDurationSaved() = runBlocking {
        val v = sample("1", "Movie", "TV", "2026-11-13", 1)
        dao.importVideo(v); dao.saveProgress(v.uri, 10000, 120000, 555)
        val saved = dao.getVideo(v.uri)!!
        assertEquals(10000L, saved.progressMs)
        assertEquals(120000L, saved.durationMs)
        assertEquals(555L, saved.lastPlayedAt)
    }
    @Test fun channelCanBeRenamed() = runBlocking {
        val v = sample("1", "Movie", "TV", "2026-11-13", 1)
        dao.importVideo(v); dao.setChannel(v.uri, "Movies")
        assertEquals("Movies", dao.getVideo(v.uri)!!.channel)
    }
    @Test fun videosCanBeRemovedFromLibrary() = runBlocking {
        val v = sample("1", "Movie", "TV", "2026-11-13", 1)
        dao.importVideo(v); dao.removeVideo(v.uri)
        assertNull(dao.getVideo(v.uri))
    }
    @Test fun srtSubtitleStored() = runBlocking {
        val s = SubtitleFile("content://videos/1", "ar", "content://subtitles/1", "application/x-subrip")
        dao.saveSubtitle(s)
        assertEquals(s, dao.subtitles(s.videoUri).first().single())
    }
    @Test fun vttSubtitleStored() = runBlocking {
        val s = SubtitleFile("content://videos/1", "en", "content://subtitles/vtt", "text/vtt")
        dao.saveSubtitle(s)
        assertEquals(s.mimeType, dao.subtitles(s.videoUri).first().single().mimeType)
    }
    @Test fun languageSubtitleCanBeReplaced() = runBlocking {
        dao.saveSubtitle(SubtitleFile("video", "fr", "one", "text/vtt"))
        dao.saveSubtitle(SubtitleFile("video", "fr", "two", "application/x-subrip"))
        assertEquals("two", dao.subtitles("video").first().single().uri)
    }
    @Test fun subtitleCanBeRemoved() = runBlocking {
        dao.saveSubtitle(SubtitleFile("video", "fr", "two", "text/vtt"))
        dao.removeSubtitle("video", "fr")
        assertTrue(dao.subtitles("video").first().isEmpty())
    }
    @Test fun dubbedAudioStoredAndReplaced() = runBlocking {
        dao.saveDubbedAudio(DubbedAudio("video", "ja", "original"))
        dao.saveDubbedAudio(DubbedAudio("video", "ja", "new"))
        assertEquals("new", dao.dubbedAudios("video").first().single().uri)
    }
    @Test fun dubbedAudioCanBeRemoved() = runBlocking {
        dao.saveDubbedAudio(DubbedAudio("video", "es", "audio"))
        dao.removeDubbedAudio("video", "es")
        assertTrue(dao.dubbedAudios("video").first().isEmpty())
    }
}
