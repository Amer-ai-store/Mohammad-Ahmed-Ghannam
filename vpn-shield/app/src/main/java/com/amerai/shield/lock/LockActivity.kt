package com.amerai.shield.lock

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.amerai.shield.data.AppsRepository
import com.amerai.shield.data.ShieldStore
import com.amerai.shield.ui.*

/** شاشة إدخال الرقم السري التي تظهر فوق التطبيق المقفل. */
class LockActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val pkg = intent.getStringExtra(EXTRA_PKG) ?: run { finish(); return }
        val store = ShieldStore(this)
        val label = AppsRepository.labelOf(this, pkg)

        setContent {
            AmerShieldTheme {
                CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
                    Surface(Modifier.fillMaxSize(), color = Ink) {
                        PinGate(
                            label = label,
                            onCheck = { store.checkPin(it) },
                            onSuccess = {
                                LockState.markUnlocked(pkg)
                                setResult(Activity.RESULT_OK)
                                finish()
                            },
                            onCancel = {
                                // الرجوع إلى الشاشة الرئيسية بدل فتح التطبيق المقفل.
                                val home = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME)
                                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                                runCatching { startActivity(home) }
                                finish()
                            }
                        )
                    }
                }
            }
        }
    }

    override fun onBackPressed() {
        val home = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        runCatching { startActivity(home) }
        finish()
    }

    companion object {
        const val EXTRA_PKG = "pkg"
    }
}

@Composable
private fun PinGate(
    label: String,
    onCheck: (String) -> Boolean,
    onSuccess: () -> Unit,
    onCancel: () -> Unit
) {
    var pin by remember { mutableStateOf("") }
    var error by remember { mutableStateOf(false) }

    Column(
        Modifier.fillMaxSize().background(Ink).padding(28.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        androidx.compose.material3.Icon(Icons.Filled.Lock, null, tint = Violet, modifier = Modifier.size(56.dp))
        Spacer(Modifier.height(16.dp))
        Text("تطبيق مقفل", color = TextHi, fontSize = 20.sp, fontWeight = FontWeight.Bold)
        Text(label, color = TextLo, fontSize = 14.sp)
        Spacer(Modifier.height(24.dp))
        OutlinedTextField(
            value = pin,
            onValueChange = {
                if (it.length <= 8) { pin = it.filter { c -> c.isDigit() }; error = false }
                if (pin.length >= 4 && onCheck(pin)) onSuccess()
            },
            label = { Text("الرقم السري") },
            isError = error,
            visualTransformation = PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
            modifier = Modifier.fillMaxWidth()
        )
        if (error) { Spacer(Modifier.height(8.dp)); Text("رقم غير صحيح", color = Danger, fontSize = 13.sp) }
        Spacer(Modifier.height(20.dp))
        Button(
            onClick = { if (onCheck(pin)) onSuccess() else error = true },
            colors = ButtonDefaults.buttonColors(containerColor = Violet),
            modifier = Modifier.fillMaxWidth()
        ) { Text("فتح", color = TextHi) }
        Spacer(Modifier.height(10.dp))
        TextButton(onClick = onCancel, modifier = Modifier.fillMaxWidth()) {
            Text("رجوع", color = TextLo)
        }
    }
}
