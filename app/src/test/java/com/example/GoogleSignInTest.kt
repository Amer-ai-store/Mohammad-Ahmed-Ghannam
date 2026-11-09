package com.example

import android.content.Context
import android.os.Looper
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialUnknownException
import androidx.credentials.exceptions.NoCredentialException
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import com.example.data.AppDatabase
import com.example.data.FirebaseSetup
import com.example.data.GoogleSignIn
import com.example.data.GoogleSignInResult
import com.example.data.LocalAuthBackend
import com.example.ui.MarketViewModel
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [36])
class GoogleSignInTest {

    private lateinit var db: AppDatabase
    private lateinit var viewModel: MarketViewModel
    private var googleSignOuts = 0

    @Before
    fun setUp() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        db = Room.inMemoryDatabaseBuilder(context, AppDatabase::class.java).allowMainThreadQueries().build()
        viewModel = MarketViewModel(
            db.userDao(), db.productDao(), db.savedProductDao(), db.orderDao(), db.chatReportDao(),
            db.cartItemDao(), db.bankCardDao(), db.searchQueryDao(), db.familyShoppingListDao(),
            db.storedOrganicItemDao(), LocalAuthBackend(db.credentialDao()),
            googleSignOut = { googleSignOuts++ }
        )
    }

    @After
    fun tearDown() { db.close() }

    private fun awaitUntil(condition: suspend () -> Boolean) = runBlocking {
        repeat(500) {
            shadowOf(Looper.getMainLooper()).idle()
            if (condition()) return@runBlocking
            Thread.sleep(10)
        }
        fail("Condition was not met in time")
    }

    @Test
    fun cancellationAndMissingAccountAreRecognised() {
        assertEquals(GoogleSignInResult.Cancelled, GoogleSignIn.classify(GetCredentialCancellationException("closed")))
        assertEquals(GoogleSignInResult.NoAccount, GoogleSignIn.classify(NoCredentialException("none")))
        assertTrue(GoogleSignIn.classify(GetCredentialUnknownException("boom")) is GoogleSignInResult.Failed)
        assertTrue(GoogleSignIn.classify(IllegalStateException("x")) is GoogleSignInResult.Failed)
    }

    @Test
    fun everyFailureHasAnArabicMessageAndSuccessHasNone() {
        assertEquals("تم إلغاء تسجيل الدخول عبر Google.", GoogleSignIn.message(GoogleSignInResult.Cancelled, "ar"))
        assertTrue(GoogleSignIn.message(GoogleSignInResult.NoAccount, "ar")!!.startsWith("لا يوجد حساب Google على هذا الجهاز"))
        val failures = listOf(
            GoogleSignInResult.Cancelled, GoogleSignInResult.NoAccount, GoogleSignInResult.NotConfigured,
            GoogleSignInResult.Network, GoogleSignInResult.Failed("x")
        )
        for (r in failures) {
            val ar = GoogleSignIn.message(r, "ar")
            assertNotNull(ar)
            assertTrue("Arabic text expected for $r: $ar", ar!!.any { it in '؀'..'ۿ' })
            assertFalse(GoogleSignIn.message(r, "en")!!.any { it in '؀'..'ۿ' })
        }
        assertNull(GoogleSignIn.message(GoogleSignInResult.Success("a@b.co", null), "ar"))
    }

    @Test
    fun placeholderWebClientIdKeepsGoogleSignInOff() {
        assertFalse(GoogleSignIn.isConfigured("MY_FIREBASE_WEB_CLIENT_ID"))
        assertFalse(GoogleSignIn.isConfigured(""))
        assertEquals(FirebaseSetup.isConfigured(), GoogleSignIn.isConfigured("1234-abc.apps.googleusercontent.com"))
    }

    @Test
    fun googleAccountOpensACustomerProfileNamedFromGoogle() {
        viewModel.completeGoogleSignIn("New.Buyer@Gmail.com", "سارة أحمد")
        awaitUntil { viewModel.currentUser.value != null }
        val user = viewModel.currentUser.value!!
        assertEquals("new.buyer@gmail.com", user.email)
        assertEquals("سارة أحمد", user.name)
        assertEquals("Customer", user.role)

        // Signing in again reuses the same profile instead of creating a second one.
        viewModel.logout()
        awaitUntil { googleSignOuts == 1 }
        viewModel.completeGoogleSignIn("new.buyer@gmail.com", null)
        awaitUntil { viewModel.currentUser.value != null }
        assertEquals(1, runBlocking { db.userDao().getAllUsers().first().size })
    }

    @Test
    fun adminEmailIsRefusedThroughGoogle() {
        viewModel.completeGoogleSignIn("ZXZX.mohammad91@gmail.com", "Owner")
        awaitUntil { viewModel.errorMessage.value != null }
        assertNull(viewModel.currentUser.value)
        assertEquals(1, googleSignOuts)
        assertEquals(0, runBlocking { db.userDao().getAllUsers().first().size })
    }
}
