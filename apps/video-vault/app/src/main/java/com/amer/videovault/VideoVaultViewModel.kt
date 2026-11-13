package com.amer.videovault

import android.app.Application
import android.content.ContentResolver
import android.content.Intent
import android.net.Uri
import android.provider.OpenableColumns
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

@OptIn(ExperimentalCoroutinesApi::class)
class VideoVaultViewModel(application: Application) : AndroidViewModel(application) {
    private val resolver = application.contentResolver
    private val dao = VideoVaultDatabase.get(application).videoDao()

    val searchText = MutableStateFlow("")
    val favoritesOnly = MutableStateFlow(false)
    val selectedSubtitleLanguage = MutableStateFlow<String?>(null)

    val videos = combine(searchText, favoritesOnly) { text, favorite -> text.trim() to favorite }
        .flatMapLatest { (text, favorite) -> dao.searchVideos(text, favorite) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val recentlyWatched = dao.recentlyWatched()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    fun subtitles(videoUri: String) = dao.subtitles(videoUri)
    fun dubbedAudios(videoUri: String) = dao.dubbedAudios(videoUri)

    fun setSearch(text: String) { searchText.value = text }
    fun setFavoritesOnly(enabled: Boolean) { favoritesOnly.value = enabled }
    fun selectSubtitle(code: String?) { selectedSubtitleLanguage.value = code }

    private fun persist(uri: Uri) {
        runCatching {
            resolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
    }

    private fun name(uri: Uri): String = runCatching {
        resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
            if (cursor.moveToFirst()) cursor.getString(0) else null
        } ?: uri.lastPathSegment.orEmpty()
    }.getOrDefault(uri.lastPathSegment ?: "untitled")

    fun importVideos(uris: List<Uri>) = viewModelScope.launch(Dispatchers.IO) {
        uris.distinct().forEach { uri ->
            persist(uri)
            val now = System.currentTimeMillis()
            dao.importVideo(
                LocalVideo(
                    uri = uri.toString(),
                    title = name(uri).substringBeforeLast('.', name(uri)),
                    importedDate = MediaSupport.importDate(now),
                    importedAt = now,
                    mimeType = resolver.getType(uri) ?: "video/*"
                )
            )
        }
    }

    fun toggleFavorite(uri: String) = viewModelScope.launch(Dispatchers.IO) {
        dao.toggleFavorite(uri)
    }

    fun updateChannel(uri: String, channel: String) = viewModelScope.launch(Dispatchers.IO) {
        dao.setChannel(uri, channel.trim().ifBlank { "محلي" })
    }

    fun removeVideo(uri: String) = viewModelScope.launch(Dispatchers.IO) {
        dao.removeVideo(uri)
    }

    fun saveProgress(uri: String, positionMs: Long, durationMs: Long) = viewModelScope.launch(Dispatchers.IO) {
        dao.saveProgress(
            uri, positionMs.coerceAtLeast(0L), durationMs.coerceAtLeast(0L),
            System.currentTimeMillis()
        )
    }

    fun addSubtitle(videoUri: String, language: String, fileUri: Uri, explicitName: String? = null) =
        viewModelScope.launch(Dispatchers.IO) {
            val fileName = explicitName ?: name(fileUri)
            val mime = MediaSupport.subtitleMime(fileName) ?: return@launch
            if (SubtitleLanguage.fromCode(language) == null) return@launch
            persist(fileUri)
            dao.saveSubtitle(SubtitleFile(videoUri, language, fileUri.toString(), mime))
        }

    fun removeSubtitle(videoUri: String, language: String) = viewModelScope.launch(Dispatchers.IO) {
        dao.removeSubtitle(videoUri, language)
    }

    fun addDubbedAudio(videoUri: String, language: String, fileUri: Uri) =
        viewModelScope.launch(Dispatchers.IO) {
            if (SubtitleLanguage.fromCode(language) == null) return@launch
            persist(fileUri)
            dao.saveDubbedAudio(DubbedAudio(videoUri, language, fileUri.toString()))
        }

    fun removeDubbedAudio(videoUri: String, language: String) = viewModelScope.launch(Dispatchers.IO) {
        dao.removeDubbedAudio(videoUri, language)
    }
}
