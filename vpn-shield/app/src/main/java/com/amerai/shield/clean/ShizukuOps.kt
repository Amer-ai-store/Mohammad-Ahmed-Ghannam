package com.amerai.shield.clean

import rikka.shizuku.Shizuku

/**
 * عمليات مميّزة اختيارية عبر Shizuku (يفعّلها المستخدم بنفسه لمرة واحدة، بلا روت).
 * التنفيذ الفعلي للإيقاف/التجميد يأتي في المرحلة التالية؛ هنا فحص الجاهزية فقط.
 */
object ShizukuOps {
    fun ready(): Boolean = try {
        Shizuku.pingBinder() && Shizuku.checkSelfPermission() == android.content.pm.PackageManager.PERMISSION_GRANTED
    } catch (_: Throwable) {
        false
    }

    fun requestPermission() {
        try {
            if (Shizuku.pingBinder() &&
                Shizuku.checkSelfPermission() != android.content.pm.PackageManager.PERMISSION_GRANTED
            ) {
                Shizuku.requestPermission(1001)
            }
        } catch (_: Throwable) {
        }
    }
}
