# Cipher 0.2.0 — Android preview build

Built on 2026-09-24 from the source in this checkout. **Debug build; not a production security release.**

## Download

- File: `cipher-0.2.0-debug.apk`
- Size: **884,027 bytes** (approximately 0.84 MiB)
- SHA-256: `44a4fa374b9428b517cb040dfef085168b9d7ea9d89249eab8de0567d01ca0bd`
- Package: `com.securechat.app`
- Launcher: `com.securechat.app.MainActivity`
- Version: 0.2.0 / versionCode 2
- minSdk: 26 (Android 8.0); targetSdk and compileSdk: 35 (Android 15)
- Initial relay: **none**. Starts with the bundled offline demo and local tools.

To connect a real account, deploy the included server over HTTPS and use **Settings → Android relay** inside the APK. The same connection dialog is accessible from sign-up/login. Both contacts need accounts on that deployment. The live Arena browser preview is a development environment, not a promised permanent service.

## Verification actually performed

- `npm run build`: TypeScript and optimized client production build passed.
- `npm test`: **19/19** crypto/API tests passed, including tampering rejection and ciphertext-only message storage.
- `CIPHER_BUNDLED_BROWSER=1 npm run test:e2e`: **4/4** browser tests passed, including two separately authenticated accounts exchanging text and photos, fingerprint verification, local vault round trips, session lock/unlock, and Android-sized layouts.
- Android Java source compiled against API 35 successfully (Java 8 bytecode for the low-level packaging path).
- D8 generated the native DEX successfully.
- AAPT2 compiled/linked resources against **API 35**. `aapt2 dump badging` confirmed the package, launcher, versions, and permissions.
- APK ZIP contains `classes.dex`, `assets/web/index.html`, all hashed JS/CSS/font/media assets, and uncompressed `resources.arsc`.
- ZIP alignment verified.
- APK signing schemes **v2 and v3** verified by the APK signer.
- Browser smoke check reported no uncaught page errors; a 390px-wide layout had no horizontal overflow. Preview Host requests for `*.e2b.app` returned HTTP 200.

- Production smoke test: local vault encryption successfully ran under the production CSP; JavaScript assets were served with gzip compression.
- `npm audit --omit=dev`: no known vulnerabilities reported by npm at build time (not a security review).

## What has NOT been verified

- Installation, rendering, microphone, file picker/export, background behavior, screenshot prevention, and lifecycle behavior on a physical Android device or emulator. No Android runtime was available here.
- The full Gradle/Android Lint pipeline in this sandbox. Direct Google SDK / Maven distribution endpoints were unavailable. The standard build configuration and CI workflow are provided. No remote CI run had been triggered at the time this local artifact was built; subsequent pull-request CI results are separate from this local build report.
- Independent cryptographic review, a penetration test, reproducible bit-for-bit release builds, release-key custody, or protection against advanced/state-level adversaries.

## Local build path

The APK was assembled using standard Java/Android compilation stages rather than claiming an unavailable local Gradle run:

1. Build the shared React client with Vite; `npm run android:sync` copies `dist/` into Android assets.
2. Compile `app/src/main/java/com/securechat/app/MainActivity.java` and a generated debug `BuildConfig` using OpenJDK javac 17.0.2 (running on an isolated JRE 17.0.9), targeting Java 8 bytecode and using Android API 35 classes.
3. Compile the resulting classes to DEX with D8/R8 **8.11.6-dev**, min API 26.
4. Compile and link resources with Android SDK **AAPT2 2.19-11952161** against API 35. Inject the same application ID, version values, min/target SDK, and debug flag as the Gradle configuration.
5. Add the DEX and production web assets, align, debug-sign, and verify with uber-apk-signer 1.2.1.

Build-time downloads were kept outside Git. Public, pinned Git blob sources used for the restricted-network environment:

| Tool | Source / Git blob |
|---|---|
| Android API 35 jar | `Reginer/aosp-android-jar`, `4eb4b54d96953be09a2a8032e50b5b076a13d98e` |
| javac module | `msft-mirror-aosp/platform.prebuilts.jdk.jdk17`, `7e69c86f6a5c9a7eaf4b3a8ba9bf2acc0fc82d23` |
| javac option module | same repository, `a004d78bb8ca25fdf53d0ba6f842c0047258f8ba` |
| R8/D8 jar | `msft-mirror-aosp/platform.prebuilts.r8`, `ed6d5f67fd115b370ecbe6df264e8e90b42b4fae` |
| AAPT2 | `msft-mirror-aosp/platform.prebuilts.sdk`, `adee4602e5a2041e647431b4ba4925f90d0b511e` |

The recommended normal build is documented in the root README: **JDK 17 + Android SDK 35 + the checksum-pinned Gradle 8.9 wrapper**. CI generates its own debug-signed APK. These different build/signing paths are not claimed to produce byte-identical artifacts.

## Signing warning

This APK uses the signer's **public embedded Android debug key**, not a privately held release key. Its certificate SHA-256 is:

`1e08a903aef9c3a721510b64ec764d01d3d094eb954161b62544ea8f187b5953`

A signature check proves integrity relative to that debug key, **not** trusted production authorship. Anyone with the public debug key can sign another package. Do not distribute or rely on it as a secure production release. A locally rebuilt or CI-generated APK may use a different debug key, requiring the old preview to be uninstalled before installation; uninstalling clears on-device settings and key-verification records.

For genuinely sensitive communication, use a mature independently reviewed messenger instead of this prototype.
