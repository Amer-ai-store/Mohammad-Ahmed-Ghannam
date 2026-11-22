package com.amerai.shield.clean

import android.content.pm.PackageManager
import rikka.shizuku.Shizuku

/**
 * عمليات مميّزة اختيارية عبر Shizuku (يفعّلها المستخدم بنفسه، بلا روت).
 * تُستخدم للإيقاف الإجباري/التجميد للتطبيقات التي يختارها المستخدم فقط.
 */
object ShizukuOps {

    fun ready(): Boolean = try {
        Shizuku.pingBinder() &&
            Shizuku.checkSelfPermission() == PackageManager.PERMISSION_GRANTED
    } catch (_: Throwable) {
        false
    }

    fun requestPermission() {
        try {
            if (Shizuku.pingBinder() &&
                Shizuku.checkSelfPermission() != PackageManager.PERMISSION_GRANTED
            ) {
                Shizuku.requestPermission(1001)
            }
        } catch (_: Throwable) {
        }
    }

    /** ينفّذ أمر شل بصلاحية Shizuku. يعيد true عند نجاح التنفيذ. */
    private fun exec(cmd: String): Boolean {
        return try {
            val m = Shizuku::class.java.getDeclaredMethod(
                "newProcess",
                Array<String>::class.java,
                Array<String>::class.java,
                String::class.java
            )
            m.isAccessible = true
            val proc = m.invoke(null, arrayOf("sh", "-c", cmd), null, null)
            val waitFor = proc.javaClass.getMethod("waitFor")
            val code = waitFor.invoke(proc) as? Int ?: -1
            code == 0
        } catch (_: Throwable) {
            false
        }
    }

    fun forceStop(pkg: String): Boolean = exec("am force-stop $pkg")

    fun freeze(pkg: String): Boolean = exec("pm disable-user --user 0 $pkg")

    fun unfreeze(pkg: String): Boolean = exec("pm enable $pkg")
}
