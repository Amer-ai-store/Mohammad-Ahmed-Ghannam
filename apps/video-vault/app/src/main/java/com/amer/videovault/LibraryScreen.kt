package com.amer.videovault

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp

@Composable
fun LibraryScreen(vm: VideoVaultViewModel, onPlay: (LocalVideo) -> Unit) {
    val videos by vm.videos.collectAsState()
    val recent by vm.recentlyWatched.collectAsState()
    val query by vm.searchText.collectAsState()
    val favoritesOnly by vm.favoritesOnly.collectAsState()
    var recentOnly by remember { mutableStateOf(false) }
    val launcher = rememberLauncherForActivityResult(ActivityResultContracts.OpenMultipleDocuments()) {
        if (it.isNotEmpty()) vm.importVideos(it)
    }
    val shown = if (recentOnly) {
        recent.filter { MediaSupport.matches(it, query) && (!favoritesOnly || it.isFavorite) }
    } else videos
    var editing by remember { mutableStateOf<LocalVideo?>(null) }
    var channelInput by remember { mutableStateOf("") }

    Column(modifier = Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("VIDEO VAULT", style = MaterialTheme.typography.headlineMedium)
        Text("مكتبتك المحلية — تشغيل وترجمة ومسارات صوتية دون تجاوز حماية المحتوى", style = MaterialTheme.typography.bodySmall)
        Button(onClick = { launcher.launch(arrayOf("video/*", "application/octet-stream")) }) {
            Text("إضافة مقاطع من الجهاز")
        }
        OutlinedTextField(
            value = query,
            onValueChange = vm::setSearch,
            label = { Text("ابحث بالعنوان أو التاريخ YYYY-MM-DD أو القناة") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            FilterChip(selected = !recentOnly && !favoritesOnly, onClick = {
                recentOnly = false; vm.setFavoritesOnly(false)
            }, label = { Text("الكل") })
            FilterChip(selected = !recentOnly && favoritesOnly, onClick = {
                recentOnly = false; vm.setFavoritesOnly(true)
            }, label = { Text("المفضلة ♥") })
            FilterChip(selected = recentOnly, onClick = {
                recentOnly = true; vm.setFavoritesOnly(false)
            }, label = { Text("شوهد مؤخرًا") })
        }
        Text("النتائج: ${shown.size}", style = MaterialTheme.typography.labelMedium)
        if (shown.isEmpty()) {
            Text("لا توجد ملفات مطابقة. أضف فيديوهات من الجهاز أولًا.")
        }
        LazyColumn(contentPadding = PaddingValues(bottom = 32.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(shown, key = { it.uri }) { video ->
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Column(
                                modifier = Modifier.weight(1f).clickable { onPlay(video) }
                            ) {
                                Text(video.title, maxLines = 2, overflow = TextOverflow.Ellipsis,
                                    style = MaterialTheme.typography.titleMedium)
                                Text("${video.channel} • ${video.importedDate}", style = MaterialTheme.typography.bodySmall)
                                if (video.durationMs > 0) {
                                    val percent = (video.progressMs.toFloat() / video.durationMs).coerceIn(0f, 1f)
                                    LinearProgressIndicator(progress = { percent }, modifier = Modifier.fillMaxWidth())
                                    Text("متابعة من ${MediaSupport.displayTime(video.progressMs)} / ${MediaSupport.displayTime(video.durationMs)}",
                                        style = MaterialTheme.typography.labelSmall)
                                }
                            }
                            TextButton(onClick = { vm.toggleFavorite(video.uri) }) {
                                Text(if (video.isFavorite) "♥" else "♡",
                                    color = if (video.isFavorite) MaterialTheme.colorScheme.error
                                        else MaterialTheme.colorScheme.onSurface)
                            }
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            TextButton(onClick = { onPlay(video) }) { Text("تشغيل") }
                            TextButton(onClick = {
                                editing = video; channelInput = video.channel
                            }) { Text("القناة") }
                            TextButton(onClick = { vm.removeVideo(video.uri) }) { Text("إزالة من المكتبة") }
                        }
                    }
                }
            }
        }
    }
    editing?.let { video ->
        AlertDialog(
            onDismissRequest = { editing = null },
            title = { Text("تعديل اسم القناة") },
            text = {
                OutlinedTextField(value = channelInput, onValueChange = { channelInput = it },
                    label = { Text("القناة / المجموعة") }, singleLine = true)
            },
            confirmButton = { TextButton(onClick = {
                vm.updateChannel(video.uri, channelInput); editing = null
            }) { Text("حفظ") } },
            dismissButton = { TextButton(onClick = { editing = null }) { Text("إلغاء") } }
        )
    }
}
