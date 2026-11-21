package com.amerai.shield.vpn

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkRequest
import com.amerai.shield.data.ShieldStore

/**
 * إعادة الاتصال التلقائية: إذا كان المستخدم قد شغّل VPN وطلب "إعادة اتصال تلقائية"،
 * فعند عودة الشبكة بعد انقطاع يُعاد رفع النفق. المستخدم يبقى قادرًا على الإيقاف في أي لحظة.
 */
object ReconnectManager {

    @Volatile private var registered = false

    fun install(context: Context) {
        if (registered) return
        val app = context.applicationContext
        val cm = app.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return
        val request = NetworkRequest.Builder().build()
        cm.registerNetworkCallback(request, object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                val store = ShieldStore(app)
                if (!store.autoReconnect) return
                val id = store.selectedProfileId ?: return
                val shouldBeUp = store.selectedProfileId != null &&
                    VpnManager.state.value.status != VpnManager.Status.DOWN
                if (!shouldBeUp) return
                if (VpnManager.isUp(app)) return
                val profile = store.profiles().firstOrNull { it.id == id } ?: return
                VpnManager.connect(app, profile.name, profile.conf, store.effectiveSplitApps())
            }
        })
        registered = true
    }
}
