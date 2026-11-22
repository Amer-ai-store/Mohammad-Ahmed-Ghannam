package com.amerai.shield.lock

import java.util.concurrent.ConcurrentHashMap

/**
 * حالة القفل أثناء التشغيل: أي تطبيق مقفل تم فتحه بالرقم السري يبقى مفتوحًا
 * حتى يغادر المقدّمة، ثم يُعاد قفله. كل شيء بأمر المستخدم وبرقمه السري.
 */
object LockState {
    private val unlocked = ConcurrentHashMap.newKeySet<String>()

    fun markUnlocked(pkg: String) { unlocked.add(pkg) }
    fun isUnlocked(pkg: String): Boolean = unlocked.contains(pkg)
    fun relock(pkg: String) { unlocked.remove(pkg) }
    fun relockAllExcept(keep: String?) {
        unlocked.forEach { if (it != keep) unlocked.remove(it) }
    }
}
