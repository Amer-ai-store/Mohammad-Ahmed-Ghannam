package com.amerai.shield.vpn

import android.content.Context
import com.wireguard.android.backend.Backend
import com.wireguard.android.backend.GoBackend
import com.wireguard.android.backend.Tunnel
import com.wireguard.config.Config
import com.wireguard.config.Interface
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.BufferedReader
import java.io.StringReader

/**
 * الطبقة التي تدير اتصال WireGuard الحقيقي عبر GoBackend.
 * الاتصال لا يبدأ إلا بأمر المستخدم، ولا يخفي موقعه إلا للتطبيقات التي يختارها (Split Tunneling).
 */
object VpnManager {

    enum class Status { DOWN, CONNECTING, UP, ERROR }

    data class State(
        val status: Status = Status.DOWN,
        val profileName: String? = null,
        val message: String? = null
    )

    private val _state = MutableStateFlow(State())
    val state: StateFlow<State> = _state.asStateFlow()

    private const val TUNNEL_NAME = "amer-shield"

    @Volatile private var backend: Backend? = null
    private val scope = CoroutineScope(Dispatchers.Default)

    private val tunnel = object : Tunnel {
        override fun getName(): String = TUNNEL_NAME
        override fun onStateChange(newState: Tunnel.State) {
            _state.value = _state.value.copy(
                status = when (newState) {
                    Tunnel.State.UP -> Status.UP
                    Tunnel.State.DOWN -> Status.DOWN
                    else -> Status.CONNECTING
                }
            )
        }
    }

    private fun backend(context: Context): Backend {
        return backend ?: synchronized(this) {
            backend ?: GoBackend(context.applicationContext).also { backend = it }
        }
    }

    /**
     * يبني Config من نص ملف .conf الذي استورده المستخدم.
     * عند تمرير [splitApps] يُوجّه الـ VPN لهذه الحزم فقط (مثل تيك توك) ويبقى الباقي على الاتصال العادي.
     */
    fun buildConfig(confText: String, splitApps: Set<String>): Config {
        val parsed = Config.parse(BufferedReader(StringReader(confText)))
        if (splitApps.isEmpty()) return parsed

        val oldIf = parsed.getInterface()
        val ifBuilder = Interface.Builder().apply {
            parsePrivateKey(oldIf.keyPair.privateKey.toBase64())
            addAddresses(oldIf.addresses)
            addDnsServers(oldIf.dnsServers)
            if (oldIf.listenPort.isPresent) parseListenPort(oldIf.listenPort.get().toString())
            if (oldIf.mtu.isPresent) parseMtu(oldIf.mtu.get().toString())
            includeApplications(splitApps)
        }
        return Config.Builder()
            .setInterface(ifBuilder.build())
            .addPeers(parsed.peers)
            .build()
    }

    fun connect(context: Context, profileName: String, confText: String, splitApps: Set<String>) {
        _state.value = State(Status.CONNECTING, profileName)
        scope.launch {
            try {
                val cfg = buildConfig(confText, splitApps)
                withContext(Dispatchers.IO) {
                    backend(context).setState(tunnel, Tunnel.State.UP, cfg)
                }
                _state.value = State(Status.UP, profileName)
            } catch (t: Throwable) {
                _state.value = State(Status.ERROR, profileName, t.message ?: "connect failed")
            }
        }
    }

    fun disconnect(context: Context) {
        scope.launch {
            try {
                withContext(Dispatchers.IO) {
                    backend(context).setState(tunnel, Tunnel.State.DOWN, null)
                }
            } catch (_: Throwable) {
            } finally {
                _state.value = State(Status.DOWN)
            }
        }
    }

    fun isUp(context: Context): Boolean = try {
        backend(context).runningTunnelNames.contains(TUNNEL_NAME)
    } catch (_: Throwable) {
        false
    }
}
