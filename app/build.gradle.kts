plugins { id("com.android.application") }

android {
    namespace = "com.securechat.app"
    compileSdk = 35
    defaultConfig {
        applicationId = "com.securechat.app"
        minSdk = 26
        targetSdk = 35
        versionCode = 2
        versionName = "0.2.0"
        val relay = providers.gradleProperty("cipherOrigin").orElse("").get()
        require(relay.isEmpty() || (relay.startsWith("https://") && !relay.contains('"') && !relay.contains('\\'))) {
            "cipherOrigin must be an HTTPS origin."
        }
        buildConfigField("String", "CIPHER_ORIGIN", "\"$relay\"")
    }
    buildFeatures { buildConfig = true }
    buildTypes {
        release {
            isMinifyEnabled = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    lint { abortOnError = true }
}
// No runtime Android libraries or tracking SDKs. The same reviewed-by-tests web
// client is bundled locally by `npm run android:sync` before Gradle packaging.
