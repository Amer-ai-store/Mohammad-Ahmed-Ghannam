package com.amerai.shield.clean

import android.app.usage.UsageStatsManager
import android.content.Context
import com.amerai.shield.data.ShieldStore

/** نتيجة عملية التسريع. */
data class CleanResult(val stopped: Int, val usedShizuku: Boolean, val candidates: List<String>)

/**
 * التسريع: إيقاف إجباري للتطبيقات التي استُخدمت مؤخرًا (عدا المستثناة وتطبيقنا).
 * مع Shizuku يتم فعليًا؛ بدونه يُرجع قائمة المرشحين ليؤكّدها المستخدم عبر شاشة النظام.
 */
object Cleaner {

    fun recentlyUsed(context: Context, withinMs: Long = 60 * 60 * 1000L): List<String> {
        val usm = context.getSystemService(Context.USAGE_STATS_SERVICE) as? UsageStatsManager
            ?: return emptyList()
        val end = System.currentTimeMillis()
        val begin = end - withinMs
        val stats = runCatching {
            usm.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, begin, end)
        }.getOrNull() ?: return emptyList()
        return stats.asSequence()
            .filter { it.lastTimeUsed in begin..end && it.totalTimeInForeground > 0 }
            .map { it.packageName }
            .distinct()
            .toList()
    }

    fun candidates(context: Context): List<String> {
        val store = ShieldStore(context)
        val wl = store.cleanWhitelist
        val self = context.packageName
        return recentlyUsed(context).filter { it != self && it !in wl }
    }

    fun cleanNow(context: Context): CleanResult {
        val cands = candidates(context)
        if (!ShizukuOps.ready()) {
            return CleanResult(stopped = 0, usedShizuku = false, candidates = cands)
        }
        var stopped = 0
        cands.forEach { if (ShizukuOps.forceStop(it)) stopped++ }
        return CleanResult(stopped = stopped, usedShizuku = true, candidates = cands)
    }
}
