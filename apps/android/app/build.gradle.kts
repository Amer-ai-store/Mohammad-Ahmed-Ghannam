plugins { id("com.android.application") }

// The app opens this HTTPS address in Chrome as a Trusted Web Activity. Google sign-in works there
// (it is blocked inside plain WebViews), and company data stays behind Firestore rules.
val launchHost = "amer-ai-store.github.io"
val launchUrl = "https://$launchHost/Mohammad-Ahmed-Ghannam/one/"

android {
  namespace = "ai.jawafa.one"
  compileSdk = 35
  defaultConfig {
    applicationId = "ai.jawafa.one"
    minSdk = 26
    targetSdk = 35
    versionCode = 1
    versionName = "0.1.0"
    resValue("string", "launchUrl", launchUrl)
    resValue("string", "hostName", launchHost)
  }
  buildTypes {
    release {
      isMinifyEnabled = false
      // Release signing is configured in CI from repository secrets; never commit a keystore.
    }
  }
  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }
}

dependencies {
  implementation("com.google.androidbrowserhelper:androidbrowserhelper:2.5.0")
}
