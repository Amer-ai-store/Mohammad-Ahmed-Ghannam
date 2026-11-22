package com.amerai.shield.lock

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.view.accessibility.AccessibilityEvent
import com.amerai.shield.data.ShieldStore

/**
 * يراقب التطبيق الظاهر في المقدّمة. إذا كان ضمن التطبيقات التي اختار المستخدم قفلها
 * ولم يُفتح بعد بالرقم السري، يفتح شاشة القفل. لا يقرأ محتوى الشاشات ولا يسجّل شيئًا.
 */
class LockAccessibilityService : AccessibilityService() {

    private lateinit var store: ShieldStore
    @Volatile private var last: String? = null

    override fun onServiceConnected() {
        super.onServiceConnected()
        store = ShieldStore(this)
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return
        if (event.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return
        val pkg = event.packageName?.toString() ?: return
        if (pkg == packageName) return
        if (pkg == last) return
        last = pkg

        // عند مغادرة تطبيق مقفل، أعِد قفله ليطلب الرقم في المرة القادمة.
        LockState.relockAllExcept(pkg)

        val locked = store.lockedApps
        if (!store.hasPin()) return
        if (pkg !in locked) return
        if (LockState.isUnlocked(pkg)) return

        val i = Intent(this, LockActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
            putExtra(LockActivity.EXTRA_PKG, pkg)
        }
        runCatching { startActivity(i) }
    }

    override fun onInterrupt() {}
}
