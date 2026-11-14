package com.amer.videovault

import android.content.Context
import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.Room
import androidx.room.RoomDatabase
import kotlinx.coroutines.flow.Flow

@Entity(tableName = "local_videos")
data class LocalVideo(
    @PrimaryKey val uri: String,
    val title: String,
    val channel: String = "محلي",
    val importedDate: String,
    val importedAt: Long,
    val mimeType: String = "video/*",
    val isFavorite: Boolean = false,
    val lastPlayedAt: Long = 0L,
    val progressMs: Long = 0L,
    val durationMs: Long = 0L
)

@Entity(tableName = "subtitle_files", primaryKeys = ["videoUri", "language"])
data class SubtitleFile(
    val videoUri: String,
    val language: String,
    val uri: String,
    val mimeType: String
)

@Entity(tableName = "dubbed_audio", primaryKeys = ["videoUri", "language"])
data class DubbedAudio(
    val videoUri: String,
    val language: String,
    val uri: String
)

@Dao
interface VideoDao {
    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun importVideo(video: LocalVideo)

    @Query("""
        SELECT * FROM local_videos WHERE
        (:text = '' OR title LIKE '%' || :text || '%' COLLATE NOCASE
         OR channel LIKE '%' || :text || '%' COLLATE NOCASE
         OR importedDate LIKE '%' || :text || '%')
        AND (:favoritesOnly = 0 OR isFavorite = 1)
        ORDER BY importedAt DESC
    """)
    fun searchVideos(text: String, favoritesOnly: Boolean): Flow<List<LocalVideo>>

    @Query("SELECT * FROM local_videos WHERE lastPlayedAt > 0 ORDER BY lastPlayedAt DESC LIMIT 30")
    fun recentlyWatched(): Flow<List<LocalVideo>>

    @Query("SELECT * FROM local_videos WHERE uri = :uri LIMIT 1")
    suspend fun getVideo(uri: String): LocalVideo?

    @Query("UPDATE local_videos SET isFavorite = NOT isFavorite WHERE uri = :uri")
    suspend fun toggleFavorite(uri: String)

    @Query("UPDATE local_videos SET channel = :channel WHERE uri = :uri")
    suspend fun setChannel(uri: String, channel: String)

    @Query("UPDATE local_videos SET progressMs = :position, durationMs = :duration, lastPlayedAt = :playedAt WHERE uri = :uri")
    suspend fun saveProgress(uri: String, position: Long, duration: Long, playedAt: Long)

    @Query("DELETE FROM local_videos WHERE uri = :uri")
    suspend fun removeVideo(uri: String)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun saveSubtitle(subtitle: SubtitleFile)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun saveDubbedAudio(audio: DubbedAudio)

    @Query("SELECT * FROM subtitle_files WHERE videoUri = :uri ORDER BY language")
    fun subtitles(uri: String): Flow<List<SubtitleFile>>

    @Query("SELECT * FROM dubbed_audio WHERE videoUri = :uri ORDER BY language")
    fun dubbedAudios(uri: String): Flow<List<DubbedAudio>>

    @Query("DELETE FROM subtitle_files WHERE videoUri = :uri AND language = :language")
    suspend fun removeSubtitle(uri: String, language: String)

    @Query("DELETE FROM dubbed_audio WHERE videoUri = :uri AND language = :language")
    suspend fun removeDubbedAudio(uri: String, language: String)
}

@Database(entities = [LocalVideo::class, SubtitleFile::class, DubbedAudio::class], version = 1, exportSchema = false)
abstract class VideoVaultDatabase : RoomDatabase() {
    abstract fun videoDao(): VideoDao

    companion object {
        @Volatile private var instance: VideoVaultDatabase? = null

        fun get(context: Context): VideoVaultDatabase =
            instance ?: synchronized(this) {
                instance ?: Room.databaseBuilder(
                    context.applicationContext,
                    VideoVaultDatabase::class.java,
                    "video_vault.db"
                ).build().also { instance = it }
            }
    }
}
