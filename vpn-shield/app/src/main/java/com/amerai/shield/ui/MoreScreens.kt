package com.amerai.shield.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowForwardIos
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.amerai.shield.data.AppInfo

/** شاشة اختيار تطبيقات عامة (تُستخدم للـ Split، القفل، والاستثناء من التسريع). */
@Composable
fun AppPickerScreen(
    title: String,
    apps: List<AppInfo>,
    selected: Set<String>,
    onToggle: (String) -> Unit
) {
    Column(Modifier.fillMaxSize().padding(16.dp)) {
        SectionTitle(title)
        LazyColumn(Modifier.fillMaxSize()) {
            items(apps, key = { it.packageName }) { app ->
                val sel = app.packageName in selected
                Row(
                    Modifier
                        .fillMaxWidth()
                        .padding(vertical = 4.dp)
                        .clip(RoundedCornerShape(14.dp))
                        .background(if (sel) InkElevated else InkCard)
                        .clickable { onToggle(app.packageName) }
                        .padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(Modifier.weight(1f)) {
                        Text(app.label, color = TextHi, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
                        Text(app.packageName, color = TextLo, fontSize = 11.sp)
                    }
                    if (sel) Icon(Icons.Filled.Check, null, tint = Emerald)
                }
            }
        }
    }
}

@Composable
fun AppsLockScreen(
    hasPin: Boolean,
    lockedCount: Int,
    accessibilityEnabled: Boolean,
    onSetPin: (String) -> Unit,
    onPickLockedApps: () -> Unit,
    onEnableAccessibility: () -> Unit
) {
    var pin by remember { mutableStateOf("") }
    var pin2 by remember { mutableStateOf("") }
    var msg by remember { mutableStateOf<String?>(null) }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp)) {
        SectionTitle("قفل التطبيقات")
        GlassCard {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Filled.Lock, null, tint = Violet)
                Spacer(Modifier.width(8.dp))
                Text(
                    if (hasPin) "الرقم السري مضبوط" else "عيّن رقمًا سريًا",
                    color = TextHi, fontSize = 16.sp, fontWeight = FontWeight.SemiBold
                )
            }
            Spacer(Modifier.height(12.dp))
            OutlinedTextField(
                value = pin, onValueChange = { if (it.length <= 8) pin = it.filter { c -> c.isDigit() } },
                label = { Text("الرقم السري") },
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(Modifier.height(8.dp))
            OutlinedTextField(
                value = pin2, onValueChange = { if (it.length <= 8) pin2 = it.filter { c -> c.isDigit() } },
                label = { Text("تأكيد الرقم السري") },
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                modifier = Modifier.fillMaxWidth()
            )
            if (msg != null) { Spacer(Modifier.height(6.dp)); Text(msg!!, color = SkyBright, fontSize = 12.sp) }
            Spacer(Modifier.height(12.dp))
            Button(
                onClick = {
                    when {
                        pin.length < 4 -> msg = "الرقم السري 4 خانات على الأقل"
                        pin != pin2 -> msg = "الرقمان غير متطابقين"
                        else -> { onSetPin(pin); pin = ""; pin2 = ""; msg = "تم الحفظ ✓" }
                    }
                },
                colors = ButtonDefaults.buttonColors(containerColor = Violet),
                modifier = Modifier.fillMaxWidth()
            ) { Text("حفظ الرقم السري", color = TextHi) }
        }

        Spacer(Modifier.height(16.dp))
        GlassCard {
            Row(
                Modifier.fillMaxWidth().clickable(enabled = hasPin) { onPickLockedApps() },
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(Modifier.weight(1f)) {
                    Text("التطبيقات المقفلة", color = TextHi, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
                    Text(
                        if (!hasPin) "عيّن الرقم السري أولًا"
                        else if (lockedCount == 0) "لم تختر تطبيقات بعد"
                        else "$lockedCount تطبيق مقفل",
                        color = TextLo, fontSize = 12.sp
                    )
                }
                Icon(Icons.Filled.ArrowForwardIos, null, tint = TextLo, modifier = Modifier.size(16.dp))
            }
        }
        Spacer(Modifier.height(16.dp))
        if (!accessibilityEnabled) {
            GlassCard {
                Text("تفعيل القفل", color = TextHi, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.height(6.dp))
                Text(
                    "لكي يعمل القفل فعليًا، فعّل خدمة إمكانية الوصول «درع عامر». هي تكتشف فتح التطبيق المقفل فقط لتطلب رقمك، ولا تقرأ محتوى شاشتك.",
                    color = TextLo, fontSize = 12.sp
                )
                Spacer(Modifier.height(10.dp))
                Button(
                    onClick = onEnableAccessibility,
                    colors = ButtonDefaults.buttonColors(containerColor = Violet),
                    modifier = Modifier.fillMaxWidth()
                ) { Text("فتح إعدادات إمكانية الوصول", color = TextHi) }
            }
        } else {
            Text(
                "القفل مفعّل. يطلب الرقم السري عند فتح التطبيقات التي تختارها. كل شيء بأمرك، ويظل التطبيق قابلًا للإلغاء من جهازك.",
                color = Emerald, fontSize = 12.sp
            )
        }
    }
}

@Composable
fun CleanScreen(
    shizukuReady: Boolean,
    autoClean: Boolean,
    whitelistCount: Int,
    onCleanNow: () -> Unit,
    onToggleAuto: (Boolean) -> Unit,
    onEditWhitelist: () -> Unit,
    onSetupShizuku: () -> Unit
) {
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp)) {
        SectionTitle("تسريع الجهاز")
        GlassCard {
            Box(
                Modifier.fillMaxWidth().clip(CircleShape).background(InkElevated).clickable { onCleanNow() }.padding(18.dp),
                contentAlignment = Alignment.Center
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Filled.Bolt, null, tint = SkyBright, modifier = Modifier.size(22.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("تسريع الآن", color = TextHi, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                }
            }
            Spacer(Modifier.height(14.dp))
            Text(
                if (shizukuReady) "Shizuku مفعّل: يمكن الإيقاف الإجباري والتجميد الفعلي للتطبيقات التي تختارها."
                else "بدون Shizuku يفتح التطبيق شاشة «إيقاف إجباري» لتأكيدك. لتفعيل الإيقاف/التجميد التلقائي فعّل Shizuku.",
                color = TextLo, fontSize = 12.sp
            )
            if (!shizukuReady) {
                Spacer(Modifier.height(10.dp))
                Button(
                    onClick = onSetupShizuku,
                    colors = ButtonDefaults.buttonColors(containerColor = InkElevated),
                    modifier = Modifier.fillMaxWidth()
                ) { Text("إعداد Shizuku", color = SkyBright) }
            }
        }
        Spacer(Modifier.height(16.dp))
        GlassCard {
            ToggleRow(
                title = "تسريع تلقائي كل نصف ساعة",
                subtitle = "إيقاف تطبيقات الخلفية غير المستثناة دوريًا. يعمل فعليًا مع Shizuku.",
                checked = autoClean, onCheckedChange = onToggleAuto
            )
            Spacer(Modifier.height(6.dp))
            Box(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(InkElevated)
                    .clickable { onEditWhitelist() }.padding(14.dp)
            ) {
                Text(
                    if (whitelistCount == 0) "التطبيقات المستثناة من التسريع…" else "مستثنى: $whitelistCount تطبيق",
                    color = SkyBright, fontSize = 14.sp
                )
            }
        }
    }
}

@Composable
fun SettingsScreen(
    autoBoot: Boolean,
    autoReconnect: Boolean,
    onAutoBoot: (Boolean) -> Unit,
    onAutoReconnect: (Boolean) -> Unit,
    onOpenAlwaysOn: () -> Unit
) {
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp)) {
        SectionTitle("الإعدادات")
        GlassCard {
            ToggleRow(
                title = "تشغيل تلقائي بعد إعادة تشغيل الجهاز",
                subtitle = "يعيد رفع آخر اتصال VPN بعد الإقلاع (يتطلب موافقتك على VPN مسبقًا).",
                checked = autoBoot, onCheckedChange = onAutoBoot
            )
            ToggleRow(
                title = "إعادة اتصال تلقائية",
                subtitle = "يعيد الاتصال عند عودة الشبكة بعد انقطاع.",
                checked = autoReconnect, onCheckedChange = onAutoReconnect
            )
        }
        Spacer(Modifier.height(16.dp))
        GlassCard {
            Text("Always-on VPN", color = TextHi, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.height(6.dp))
            Text(
                "لإبقاء VPN فعّالًا بشكل دائم يوفّر أندرويد ميزة رسمية: إعدادات > الشبكة > VPN > درع عامر > «VPN دائم». هي الطريقة الآمنة للبقاء فعّالًا دون صلاحيات خطيرة.",
                color = TextLo, fontSize = 12.sp
            )
            Spacer(Modifier.height(10.dp))
            Button(
                onClick = onOpenAlwaysOn,
                colors = ButtonDefaults.buttonColors(containerColor = InkElevated),
                modifier = Modifier.fillMaxWidth()
            ) { Text("فتح إعدادات VPN", color = SkyBright) }
        }
        Spacer(Modifier.height(16.dp))
        Text(
            "ملاحظة: هذا التطبيق شفّاف وبأمرك. لا يملك صلاحية إدارة جهاز، ولا يمنع حذف نفسه، ولا يخفي نفسه عنك.",
            color = TextLo, fontSize = 12.sp
        )
    }
}
