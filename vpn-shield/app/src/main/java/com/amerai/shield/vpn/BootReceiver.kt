package com.amerai.shield.vpn

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.net.VpnService
import com.amerai.shield.data.ShieldStore

/**
 * يعيد تشغيل آخر اتصال VPN بعد إقلاع الجهاز — فقط إذا فعّل المستخدم الخيار،
 * وفقط إذا كان قد منح موافقة VPN سابقًا (بلا صلاحيات إدارة جهاز وبلا منع للحذف).
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED &&
            intent.action != Intent.ACTION_LOCKED_BOOT_COMPLETED
        ) return

        val store = ShieldStore(context)
        if (!store.autoStartOnBoot) return

        // إذا لم تُمنح موافقة الـ VPN بعد، لا يمكن البدء صامتًا — يتركه للمستخدم.
        if (VpnService.prepare(context) != null) return

        val id = store.selectedProfileId ?: return
        val profile = store.profiles().firstOrNull { it.id == id } ?: return
        VpnManager.connect(context, profile.name, profile.conf, store.effectiveSplitApps())
    }
}
