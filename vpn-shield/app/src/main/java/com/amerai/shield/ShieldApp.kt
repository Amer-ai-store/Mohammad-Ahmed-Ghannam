package com.amerai.shield

import android.app.Application
import com.amerai.shield.vpn.ReconnectManager

class ShieldApp : Application() {
    override fun onCreate() {
        super.onCreate()
        ReconnectManager.install(this)
    }
}
