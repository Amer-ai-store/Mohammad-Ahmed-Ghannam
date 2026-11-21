package com.amerai.shield.data

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject
import java.security.MessageDigest

/** حزمة إعداد VPN واحدة لدولة معيّنة (اسم + كود دولة + نص ملف WireGuard). */
data class VpnProfile(
    val id: String,
    val name: String,
    val country: String,
    val conf: String
)

/**
 * تخزين محلي بسيط وموثوق لكل إعدادات التطبيق.
 * الرقم السري يُخزَّن كبصمة SHA-256 فقط، لا كنص صريح.
 */
class ShieldStore(context: Context) {

    private val sp: SharedPreferences =
        context.applicationContext.getSharedPreferences("amer_shield", Context.MODE_PRIVATE)

    // ---------- VPN profiles ----------
    fun profiles(): List<VpnProfile> {
        val raw = sp.getString(KEY_PROFILES, null) ?: return emptyList()
        return runCatching {
            val arr = JSONArray(raw)
            (0 until arr.length()).map { i ->
                val o = arr.getJSONObject(i)
                VpnProfile(
                    id = o.getString("id"),
                    name = o.getString("name"),
                    country = o.optString("country", ""),
                    conf = o.getString("conf")
                )
            }
        }.getOrDefault(emptyList())
    }

    fun saveProfiles(list: List<VpnProfile>) {
        val arr = JSONArray()
        list.forEach { p ->
            arr.put(
                JSONObject()
                    .put("id", p.id)
                    .put("name", p.name)
                    .put("country", p.country)
                    .put("conf", p.conf)
            )
        }
        sp.edit().putString(KEY_PROFILES, arr.toString()).apply()
    }

    fun addProfile(p: VpnProfile) = saveProfiles(profiles().filter { it.id != p.id } + p)
    fun removeProfile(id: String) = saveProfiles(profiles().filter { it.id != id })

    var selectedProfileId: String?
        get() = sp.getString(KEY_SELECTED, null)
        set(value) = sp.edit().putString(KEY_SELECTED, value).apply()

    // ---------- Split tunneling ----------
    var splitEnabled: Boolean
        get() = sp.getBoolean(KEY_SPLIT_ON, false)
        set(value) = sp.edit().putBoolean(KEY_SPLIT_ON, value).apply()

    var splitApps: Set<String>
        get() = sp.getStringSet(KEY_SPLIT_APPS, emptySet()) ?: emptySet()
        set(value) = sp.edit().putStringSet(KEY_SPLIT_APPS, value).apply()

    /** الحزم التي ستمر فعليًا عبر الـ VPN (فارغة = النفق الكامل). */
    fun effectiveSplitApps(): Set<String> = if (splitEnabled) splitApps else emptySet()

    // ---------- Auto behaviour ----------
    var autoStartOnBoot: Boolean
        get() = sp.getBoolean(KEY_BOOT, false)
        set(value) = sp.edit().putBoolean(KEY_BOOT, value).apply()

    var autoReconnect: Boolean
        get() = sp.getBoolean(KEY_RECONNECT, true)
        set(value) = sp.edit().putBoolean(KEY_RECONNECT, value).apply()

    // ---------- App lock ----------
    fun setPin(pin: String) = sp.edit().putString(KEY_PIN, sha256(pin)).apply()
    fun hasPin(): Boolean = sp.getString(KEY_PIN, null) != null
    fun checkPin(pin: String): Boolean = sp.getString(KEY_PIN, null) == sha256(pin)

    var lockedApps: Set<String>
        get() = sp.getStringSet(KEY_LOCKED, emptySet()) ?: emptySet()
        set(value) = sp.edit().putStringSet(KEY_LOCKED, value).apply()

    // ---------- Cleaner ----------
    var cleanerAuto: Boolean
        get() = sp.getBoolean(KEY_CLEAN_AUTO, false)
        set(value) = sp.edit().putBoolean(KEY_CLEAN_AUTO, value).apply()

    /** التطبيقات المستثناة من الإيقاف/التجميد. */
    var cleanWhitelist: Set<String>
        get() = sp.getStringSet(KEY_CLEAN_WL, emptySet()) ?: emptySet()
        set(value) = sp.edit().putStringSet(KEY_CLEAN_WL, value).apply()

    companion object {
        private const val KEY_PROFILES = "profiles"
        private const val KEY_SELECTED = "selected_profile"
        private const val KEY_SPLIT_ON = "split_on"
        private const val KEY_SPLIT_APPS = "split_apps"
        private const val KEY_BOOT = "auto_boot"
        private const val KEY_RECONNECT = "auto_reconnect"
        private const val KEY_PIN = "pin_hash"
        private const val KEY_LOCKED = "locked_apps"
        private const val KEY_CLEAN_AUTO = "clean_auto"
        private const val KEY_CLEAN_WL = "clean_whitelist"

        fun sha256(s: String): String {
            val d = MessageDigest.getInstance("SHA-256").digest(s.toByteArray())
            return d.joinToString("") { "%02x".format(it) }
        }
    }
}
