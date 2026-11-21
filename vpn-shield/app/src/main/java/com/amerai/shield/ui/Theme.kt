package com.amerai.shield.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// لوحة ألوان بطابع عالمي: أزرق سماوي / بنفسجي على خلفية ليلية عميقة.
val Sky = Color(0xFF0EA5E9)
val SkyBright = Color(0xFF38BDF8)
val Violet = Color(0xFF7C3AED)
val Emerald = Color(0xFF10B981)
val Danger = Color(0xFFEF4444)
val Ink = Color(0xFF0B1020)
val InkCard = Color(0xFF151B2E)
val InkElevated = Color(0xFF1C2338)
val TextHi = Color(0xFFF1F5F9)
val TextLo = Color(0xFF94A3B8)

private val DarkColors = darkColorScheme(
    primary = SkyBright,
    onPrimary = Ink,
    secondary = Violet,
    tertiary = Emerald,
    background = Ink,
    onBackground = TextHi,
    surface = InkCard,
    onSurface = TextHi,
    surfaceVariant = InkElevated,
    onSurfaceVariant = TextLo,
    error = Danger
)

private val LightColors = lightColorScheme(
    primary = Sky,
    secondary = Violet,
    tertiary = Emerald
)

@Composable
fun AmerShieldTheme(content: @Composable () -> Unit) {
    val colors = if (isSystemInDarkTheme()) DarkColors else DarkColors // التطبيق ليلي دائمًا للطابع الاحترافي
    MaterialTheme(colorScheme = colors, content = content)
}
