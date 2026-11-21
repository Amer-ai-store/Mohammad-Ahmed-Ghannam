package com.amerai.shield

import android.content.Intent
import android.net.VpnService
import android.os.Bundle
import android.provider.Settings
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Apps
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.unit.LayoutDirection
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.amerai.shield.clean.ShizukuOps
import com.amerai.shield.data.AppInfo
import com.amerai.shield.data.AppsRepository
import com.amerai.shield.data.ShieldStore
import com.amerai.shield.data.VpnProfile
import com.amerai.shield.ui.*
import com.amerai.shield.vpn.VpnManager

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            AmerShieldTheme {
                CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
                    Surface(Modifier.fillMaxSize(), color = Ink) { Root() }
                }
            }
        }
    }
}

private enum class Picker { SPLIT, LOCKED, WHITELIST }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun Root() {
    val context = LocalContext.current
    val store = remember { ShieldStore(context) }
    val state by VpnManager.state.collectAsStateWithLifecycle()

    var refresh by remember { mutableIntStateOf(0) }
    val profiles by remember(refresh) { mutableStateOf(store.profiles()) }
    var selectedId by remember(refresh) { mutableStateOf(store.selectedProfileId) }

    var tab by remember { mutableIntStateOf(0) }
    var picker by remember { mutableStateOf<Picker?>(null) }
    var pendingConnect by remember { mutableStateOf<(() -> Unit)?>(null) }

    val apps by produceState(initialValue = emptyList<AppInfo>()) {
        value = AppsRepository.launchableApps(context)
    }

    val vpnConsent = rememberLauncherForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == android.app.Activity.RESULT_OK) pendingConnect?.invoke()
        pendingConnect = null
    }

    val importer = rememberLauncherForActivityResult(
        ActivityResultContracts.GetContent()
    ) { uri ->
        if (uri != null) {
            val text = runCatching {
                context.contentResolver.openInputStream(uri)?.bufferedReader()?.use { it.readText() }
            }.getOrNull()
            val name = runCatching {
                context.contentResolver.query(uri, null, null, null, null)?.use { c ->
                    val i = c.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME)
                    if (c.moveToFirst() && i >= 0) c.getString(i) else null
                }
            }.getOrNull()?.removeSuffix(".conf") ?: "خادم"
            if (!text.isNullOrBlank()) {
                val p = VpnProfile(
                    id = System.currentTimeMillis().toString(),
                    name = name,
                    country = guessCountry(name),
                    conf = text
                )
                store.addProfile(p)
                if (store.selectedProfileId == null) store.selectedProfileId = p.id
                refresh++
                Toast.makeText(context, "تم استيراد الخادم: $name", Toast.LENGTH_SHORT).show()
            } else {
                Toast.makeText(context, "تعذّر قراءة الملف", Toast.LENGTH_SHORT).show()
            }
        }
    }

    fun doConnect() {
        val id = store.selectedProfileId
        val profile = profiles.firstOrNull { it.id == id }
        if (profile == null) {
            Toast.makeText(context, "اختر خادمًا أولًا", Toast.LENGTH_SHORT).show()
            return
        }
        VpnManager.connect(context, profile.name, profile.conf, store.effectiveSplitApps())
    }

    fun toggleMain() {
        if (state.status == VpnManager.Status.UP) {
            VpnManager.disconnect(context)
            return
        }
        val prep = VpnService.prepare(context)
        if (prep != null) {
            pendingConnect = { doConnect() }
            vpnConsent.launch(prep)
        } else {
            doConnect()
        }
    }

    // شاشة اختيار التطبيقات (طبقة فوق المحتوى)
    if (picker != null) {
        val cfg: Triple<String, Set<String>, (String) -> Unit> = when (picker) {
            Picker.SPLIT -> Triple("تطبيقات VPN المحددة", store.splitApps, { pkg: String ->
                store.splitApps = store.splitApps.toMutableSet().apply { if (!add(pkg)) remove(pkg) }
                refresh++
            })
            Picker.LOCKED -> Triple("التطبيقات المقفلة", store.lockedApps, { pkg: String ->
                store.lockedApps = store.lockedApps.toMutableSet().apply { if (!add(pkg)) remove(pkg) }
                refresh++
            })
            else -> Triple("المستثنى من التسريع", store.cleanWhitelist, { pkg: String ->
                store.cleanWhitelist = store.cleanWhitelist.toMutableSet().apply { if (!add(pkg)) remove(pkg) }
                refresh++
            })
        }
        val title = cfg.first
        val selected = cfg.second
        val onToggle = cfg.third
        Scaffold(
            containerColor = Ink,
            topBar = {
                TopAppBar(
                    title = { Text(title) },
                    navigationIcon = {
                        TextButton(onClick = { picker = null }) { Text("تم", color = SkyBright) }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(
                        containerColor = Ink, titleContentColor = TextHi
                    )
                )
            }
        ) { pad ->
            Box(Modifier.padding(pad)) {
                AppPickerScreen(title, apps, selected, onToggle)
            }
        }
        return
    }

    Scaffold(
        containerColor = Ink,
        bottomBar = {
            NavigationBar(containerColor = InkCard) {
                val items = listOf(
                    "الحماية" to Icons.Filled.Shield,
                    "التطبيقات" to Icons.Filled.Apps,
                    "التسريع" to Icons.Filled.Bolt,
                    "الإعدادات" to Icons.Filled.Settings
                )
                items.forEachIndexed { i, (label, icon) ->
                    NavigationBarItem(
                        selected = tab == i,
                        onClick = { tab = i },
                        icon = { androidx.compose.material3.Icon(icon, label) },
                        label = { Text(label) },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = SkyBright,
                            selectedTextColor = SkyBright,
                            indicatorColor = InkElevated,
                            unselectedIconColor = TextLo,
                            unselectedTextColor = TextLo
                        )
                    )
                }
            }
        }
    ) { pad ->
        Box(Modifier.padding(pad)) {
            when (tab) {
                0 -> VpnScreen(
                    state = state,
                    profiles = profiles,
                    selectedId = selectedId,
                    splitEnabled = store.splitEnabled,
                    splitAppsCount = store.splitApps.size,
                    onToggleMain = { toggleMain() },
                    onSelect = { store.selectedProfileId = it; selectedId = it; refresh++ },
                    onImport = { importer.launch("*/*") },
                    onToggleSplit = { store.splitEnabled = it; refresh++ },
                    onEditSplitApps = { picker = Picker.SPLIT }
                )
                1 -> AppsLockScreen(
                    hasPin = store.hasPin(),
                    lockedCount = store.lockedApps.size,
                    onSetPin = { store.setPin(it); refresh++ },
                    onPickLockedApps = { picker = Picker.LOCKED }
                )
                2 -> CleanScreen(
                    shizukuReady = ShizukuOps.ready(),
                    autoClean = store.cleanerAuto,
                    whitelistCount = store.cleanWhitelist.size,
                    onCleanNow = {
                        Toast.makeText(context, "التسريع الفعلي يُفعّل عبر Shizuku (قريبًا في التحديث)", Toast.LENGTH_LONG).show()
                    },
                    onToggleAuto = { store.cleanerAuto = it; refresh++ },
                    onEditWhitelist = { picker = Picker.WHITELIST },
                    onSetupShizuku = { ShizukuOps.requestPermission() }
                )
                else -> SettingsScreen(
                    autoBoot = store.autoStartOnBoot,
                    autoReconnect = store.autoReconnect,
                    onAutoBoot = { store.autoStartOnBoot = it; refresh++ },
                    onAutoReconnect = { store.autoReconnect = it; refresh++ },
                    onOpenAlwaysOn = {
                        runCatching {
                            context.startActivity(Intent(Settings.ACTION_VPN_SETTINGS))
                        }.onFailure {
                            context.startActivity(Intent(Settings.ACTION_SETTINGS))
                        }
                    }
                )
            }
        }
    }
}

private fun guessCountry(name: String): String {
    val n = name.lowercase()
    return when {
        n.contains("fr") || n.contains("france") || n.contains("فرنس") -> "فرنسا"
        n.contains("us") || n.contains("united") || n.contains("america") || n.contains("أمريك") || n.contains("امريك") -> "أمريكا"
        n.contains("tr") || n.contains("turk") || n.contains("ترك") -> "تركيا"
        n.contains("ru") || n.contains("russ") || n.contains("روس") -> "روسيا"
        n.contains("ca") || n.contains("canad") || n.contains("كند") -> "كندا"
        else -> ""
    }
}
