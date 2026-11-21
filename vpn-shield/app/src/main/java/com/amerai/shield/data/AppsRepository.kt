package com.amerai.shield.data

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.drawable.Drawable

data class AppInfo(
    val packageName: String,
    val label: String,
    val icon: Drawable?
)

object AppsRepository {

    /** كل التطبيقات القابلة للتشغيل من الشاشة (ما يراه المستخدم)، مرتّبة أبجديًا. */
    fun launchableApps(context: Context): List<AppInfo> {
        val pm = context.packageManager
        val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
        val resolved = pm.queryIntentActivities(intent, 0)
        val self = context.packageName
        return resolved.asSequence()
            .map { it.activityInfo.packageName }
            .distinct()
            .filter { it != self }
            .map { pkg ->
                val appLabel = runCatching {
                    pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0)).toString()
                }.getOrDefault(pkg)
                val icon = runCatching { pm.getApplicationIcon(pkg) }.getOrNull()
                AppInfo(pkg, appLabel, icon)
            }
            .sortedBy { it.label.lowercase() }
            .toList()
    }

    fun labelOf(context: Context, pkg: String): String = runCatching {
        val pm = context.packageManager
        pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0)).toString()
    }.getOrDefault(pkg)
}
