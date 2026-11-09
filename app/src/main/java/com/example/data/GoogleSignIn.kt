package com.example.data

import android.content.Context
import android.util.Log
import androidx.credentials.ClearCredentialStateRequest
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import androidx.credentials.exceptions.NoCredentialException
import com.example.BuildConfig
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.google.android.libraries.identity.googleid.GoogleIdTokenParsingException
import com.google.firebase.FirebaseNetworkException
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.GoogleAuthProvider
import kotlinx.coroutines.tasks.await

/** Outcome of a Google sign-in attempt. Only [Success] opens an account. */
sealed interface GoogleSignInResult {
    data class Success(val email: String, val displayName: String?) : GoogleSignInResult
    /** The user closed the account picker. */
    data object Cancelled : GoogleSignInResult
    /** No Google account is on this device (or none can be used for this app). */
    data object NoAccount : GoogleSignInResult
    /** FIREBASE_WEB_CLIENT_ID or the Firebase keys are still placeholders. */
    data object NotConfigured : GoogleSignInResult
    data object Network : GoogleSignInResult
    data class Failed(val reason: String) : GoogleSignInResult
}

/**
 * Google sign-in through Credential Manager. The Google ID token signs in to the same Firebase app
 * FirestoreSync uses ("amer-live-store"), so the store keeps syncing under the signed-in account.
 */
object GoogleSignIn {
    private const val TAG = "GoogleSignIn"
    private const val PLACEHOLDER_PREFIX = "MY_"

    fun isConfigured(webClientId: String = BuildConfig.FIREBASE_WEB_CLIENT_ID): Boolean =
        webClientId.isNotBlank() && !webClientId.startsWith(PLACEHOLDER_PREFIX) && FirebaseSetup.isConfigured()

    /** Email of a Google session kept by Firebase from an earlier launch, or null (anonymous sync sessions are ignored). */
    fun signedInEmail(context: Context): String? {
        if (!isConfigured()) return null
        val user = FirestoreSync.firebaseApp(context)?.let { FirebaseAuth.getInstance(it).currentUser } ?: return null
        return user.email?.takeIf { !user.isAnonymous && it.isNotBlank() }
    }

    /** [activityContext] must be an Activity: Credential Manager shows its account picker over it. */
    suspend fun signIn(activityContext: Context): GoogleSignInResult {
        if (!isConfigured()) return GoogleSignInResult.NotConfigured
        val app = FirestoreSync.firebaseApp(activityContext) ?: return GoogleSignInResult.NotConfigured
        val option = GetGoogleIdOption.Builder()
            .setServerClientId(BuildConfig.FIREBASE_WEB_CLIENT_ID)
            // Offer every Google account on the device, not only ones that used this app before.
            .setFilterByAuthorizedAccounts(false)
            .setAutoSelectEnabled(false)
            .build()
        val request = GetCredentialRequest.Builder().addCredentialOption(option).build()
        return try {
            val credential = CredentialManager.create(activityContext).getCredential(activityContext, request).credential
            if (credential !is CustomCredential || credential.type != GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL) {
                return GoogleSignInResult.Failed("unexpected credential type")
            }
            val google = GoogleIdTokenCredential.createFrom(credential.data)
            val result = FirebaseAuth.getInstance(app)
                .signInWithCredential(GoogleAuthProvider.getCredential(google.idToken, null))
                .await()
            val email = result.user?.email ?: google.id
            if (email.isBlank()) GoogleSignInResult.Failed("no email") else GoogleSignInResult.Success(email, google.displayName)
        } catch (e: Exception) {
            classify(e).also { if (it is GoogleSignInResult.Failed) Log.e(TAG, "Google sign-in failed", e) }
        }
    }

    /** Maps a failure to a result the screen can explain. Kept separate so it can be unit tested. */
    fun classify(e: Throwable): GoogleSignInResult = when (e) {
        is GetCredentialCancellationException -> GoogleSignInResult.Cancelled
        is NoCredentialException -> GoogleSignInResult.NoAccount
        is FirebaseNetworkException -> GoogleSignInResult.Network
        is GetCredentialException -> GoogleSignInResult.Failed(e.type)
        is GoogleIdTokenParsingException -> GoogleSignInResult.Failed("invalid Google ID token")
        else -> GoogleSignInResult.Failed(e.javaClass.simpleName)
    }

    /** Text shown under the button, or null on success. */
    fun message(result: GoogleSignInResult, lang: String): String? {
        val ar = lang == "ar"
        return when (result) {
            is GoogleSignInResult.Success -> null
            GoogleSignInResult.Cancelled ->
                if (ar) "تم إلغاء تسجيل الدخول عبر Google." else "Google sign-in was cancelled."
            GoogleSignInResult.NoAccount ->
                if (ar) "لا يوجد حساب Google على هذا الجهاز. أضف حسابًا من إعدادات الجهاز ثم حاول مجددًا."
                else "There is no Google account on this device. Add one in the device settings and try again."
            GoogleSignInResult.NotConfigured ->
                if (ar) "تسجيل الدخول عبر Google غير مفعّل في هذه النسخة من التطبيق."
                else "Google sign-in is not enabled in this build of the app."
            GoogleSignInResult.Network ->
                if (ar) "تعذّر الاتصال. تحقّق من الإنترنت ثم حاول مجددًا." else "No connection. Check the internet and try again."
            is GoogleSignInResult.Failed ->
                if (ar) "تعذّر تسجيل الدخول عبر Google. حاول مرة أخرى." else "Google sign-in failed. Please try again."
        }
    }

    /**
     * Ends a Google session: forgets the chosen account in Credential Manager and returns the shared
     * Firebase app to an anonymous session so the live store keeps syncing.
     */
    suspend fun signOut(context: Context) {
        val app = FirestoreSync.firebaseApp(context) ?: return
        val auth = FirebaseAuth.getInstance(app)
        val user = auth.currentUser
        if (user == null || user.isAnonymous) return
        try { CredentialManager.create(context).clearCredentialState(ClearCredentialStateRequest()) } catch (e: Exception) { Log.w(TAG, "clearCredentialState failed", e) }
        auth.signOut()
        try { auth.signInAnonymously().await() } catch (e: Exception) { Log.w(TAG, "Anonymous sign-in after sign-out failed", e) }
    }
}
