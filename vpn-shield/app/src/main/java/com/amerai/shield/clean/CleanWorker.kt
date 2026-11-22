package com.amerai.shield.clean

import android.content.Context
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import com.amerai.shield.data.ShieldStore
import java.util.concurrent.TimeUnit

/** التسريع التلقائي الدوري (كل نصف ساعة) — يعمل فعليًا عند توفّر Shizuku. */
class CleanWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
    override fun doWork(): Result {
        val store = ShieldStore(applicationContext)
        if (!store.cleanerAuto) return Result.success()
        if (!ShizukuOps.ready()) return Result.success()
        Cleaner.cleanNow(applicationContext)
        return Result.success()
    }

    companion object {
        private const val NAME = "amer_shield_auto_clean"

        fun schedule(context: Context) {
            val req = PeriodicWorkRequestBuilder<CleanWorker>(30, TimeUnit.MINUTES)
                .setConstraints(Constraints.Builder().build())
                .build()
            WorkManager.getInstance(context)
                .enqueueUniquePeriodicWork(NAME, ExistingPeriodicWorkPolicy.UPDATE, req)
        }

        fun cancel(context: Context) {
            WorkManager.getInstance(context).cancelUniqueWork(NAME)
        }
    }
}
