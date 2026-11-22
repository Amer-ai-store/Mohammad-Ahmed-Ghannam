package com.amerai.shield.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Public
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.amerai.shield.data.VpnProfile
import com.amerai.shield.vpn.VpnManager

@Composable
fun VpnScreen(
    state: VpnManager.State,
    profiles: List<VpnProfile>,
    selectedId: String?,
    splitEnabled: Boolean,
    splitAppsCount: Int,
    onToggleMain: () -> Unit,
    onSelect: (String) -> Unit,
    onImport: () -> Unit,
    onPaste: () -> Unit,
    onToggleSplit: (Boolean) -> Unit,
    onEditSplitApps: () -> Unit
) {
    val up = state.status == VpnManager.Status.UP
    val connecting = state.status == VpnManager.Status.CONNECTING
    val ringColors = when {
        up -> listOf(Emerald, SkyBright)
        connecting -> listOf(Violet, SkyBright)
        state.status == VpnManager.Status.ERROR -> listOf(Danger, Violet)
        else -> listOf(InkElevated, InkCard)
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Spacer(Modifier.height(8.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Filled.Shield, null, tint = SkyBright, modifier = Modifier.size(26.dp))
            Spacer(Modifier.width(8.dp))
            Text("درع عامر", color = TextHi, fontSize = 22.sp, fontWeight = FontWeight.Bold)
        }
        Spacer(Modifier.height(28.dp))

        // زر الاتصال الكبير
        Box(contentAlignment = Alignment.Center) {
            Box(
                modifier = Modifier
                    .size(230.dp)
                    .clip(CircleShape)
                    .background(Brush.linearGradient(ringColors))
                    .clickable { onToggleMain() },
                contentAlignment = Alignment.Center
            ) {
                Box(
                    modifier = Modifier
                        .size(196.dp)
                        .clip(CircleShape)
                        .background(Ink),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(
                            if (up) Icons.Filled.Check else Icons.Filled.Bolt,
                            null,
                            tint = if (up) Emerald else SkyBright,
                            modifier = Modifier.size(54.dp)
                        )
                        Spacer(Modifier.height(10.dp))
                        Text(
                            when (state.status) {
                                VpnManager.Status.UP -> "متصل"
                                VpnManager.Status.CONNECTING -> "جارٍ الاتصال…"
                                VpnManager.Status.ERROR -> "فشل الاتصال"
                                else -> "غير متصل"
                            },
                            color = TextHi, fontSize = 18.sp, fontWeight = FontWeight.Bold
                        )
                        if (state.profileName != null) {
                            Text(state.profileName!!, color = TextLo, fontSize = 13.sp)
                        }
                    }
                }
            }
        }

        if (state.status == VpnManager.Status.ERROR && state.message != null) {
            Spacer(Modifier.height(10.dp))
            Text(state.message!!, color = Danger, fontSize = 12.sp)
        }

        Spacer(Modifier.height(28.dp))

        // اختيار الدولة / الملف
        GlassCard {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Filled.Public, null, tint = SkyBright)
                Spacer(Modifier.width(8.dp))
                Text("الخوادم (الدول)", color = TextHi, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.weight(1f))
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(12.dp))
                        .background(InkElevated)
                        .clickable { onImport() }
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Filled.Add, null, tint = SkyBright, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(4.dp))
                        Text("ملف", color = SkyBright, fontSize = 13.sp)
                    }
                }
                Spacer(Modifier.width(8.dp))
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(12.dp))
                        .background(InkElevated)
                        .clickable { onPaste() }
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text("لصق", color = SkyBright, fontSize = 13.sp)
                }
            }
            Spacer(Modifier.height(12.dp))
            if (profiles.isEmpty()) {
                Text(
                    "لا توجد خوادم بعد. استورد ملف WireGuard بصيغة .conf لكل دولة (فرنسا، أمريكا، تركيا، روسيا، كندا).",
                    color = TextLo, fontSize = 13.sp
                )
            } else {
                profiles.forEach { p ->
                    val sel = p.id == selectedId
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 4.dp)
                            .clip(RoundedCornerShape(14.dp))
                            .background(if (sel) InkElevated else Ink)
                            .clickable { onSelect(p.id) }
                            .padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(countryFlag(p.country), fontSize = 22.sp)
                        Spacer(Modifier.width(12.dp))
                        Column {
                            Text(p.name, color = TextHi, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
                            if (p.country.isNotBlank())
                                Text(p.country, color = TextLo, fontSize = 12.sp)
                        }
                        Spacer(Modifier.weight(1f))
                        if (sel) Icon(Icons.Filled.Check, null, tint = Emerald)
                    }
                }
            }
        }

        Spacer(Modifier.height(16.dp))

        // Split tunneling
        GlassCard {
            ToggleRow(
                title = "VPN لتطبيقات محددة فقط",
                subtitle = "مرّر تطبيقات مختارة فقط (مثل تيك توك) عبر VPN، والباقي يبقى على اتصالك العادي.",
                checked = splitEnabled,
                onCheckedChange = onToggleSplit
            )
            if (splitEnabled) {
                Spacer(Modifier.height(6.dp))
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(InkElevated)
                        .clickable { onEditSplitApps() }
                        .padding(14.dp)
                ) {
                    Text(
                        if (splitAppsCount == 0) "اختر التطبيقات…" else "تم اختيار $splitAppsCount تطبيق",
                        color = SkyBright, fontSize = 14.sp
                    )
                }
            }
        }
        Spacer(Modifier.height(24.dp))
    }
}

fun countryFlag(country: String): String = when (country.trim().lowercase()) {
    "france", "فرنسا", "fr" -> "🇫🇷"
    "usa", "us", "united states", "أمريكا", "امريكا" -> "🇺🇸"
    "turkey", "tr", "تركيا" -> "🇹🇷"
    "russia", "ru", "روسيا" -> "🇷🇺"
    "canada", "ca", "كندا" -> "🇨🇦"
    else -> "🌐"
}
