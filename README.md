# Cipher · SecureChat

A free, Android-focused messaging **prototype** with a responsive web client, a small Android shell, encrypted one-to-one account conversations, and 12 practical privacy tools.

> **Not audited. Not suitable for high-risk communications or protection against state-level adversaries.** It does not implement Signal's Double Ratchet, forward secrecy, post-compromise security, post-quantum messaging, or metadata anonymity. See [SECURITY.md](SECURITY.md) and [THREAT_MODEL.md](THREAT_MODEL.md).

## Try it

### Android

The installable, **debug-signed** preview is at [`releases/cipher-0.2.0-debug.apk`](releases/cipher-0.2.0-debug.apk). Android 8.0+ (API 26) and an up-to-date Android System WebView are required. The SHA-256 checksum and build/verification details are in `releases/`.

1. Copy the APK to your Android device and open it. Android may ask you to allow installation from that particular source. Revoke that permission afterward if desired.
2. The APK starts in an **offline demo**, with fictional contacts and temporary, unsent messages. The local tools work without a relay.
3. For real accounts, use **Settings → Android relay → Configure relay** (also accessible from the account screen). Enter an HTTPS origin running this application's production server.
4. Both contacts need accounts on the **same deployment**. Find each other by username and compare complete identity fingerprints through a trusted channel.

The APK is a test artifact, not a production release. Its signing key is a public debug key. Signature integrity was verified; physical-device / emulator behavior has **not** been verified in this environment. See [the build report](releases/BUILD_REPORT.md). No device attestation, native hardware-backed key storage, push notifications, or biometrics are claimed.

### Browser development / live preview

Requires Node **22.13+** (uses built-in SQLite).

```sh
npm ci
npm run dev
# http://localhost:5173 — one origin for both the app and relay
```

The development server binds to `0.0.0.0` and supports Arena's `*.e2b.app` preview hosts. Browser requests use relative `/api` paths, never a browser-facing localhost backend URL. In-memory demo content is never sent to the relay. Preferences, public-key pins, saved-message IDs, and approximate data counters can be stored locally; real message plaintext and private keys are not persisted in localStorage.

## What's implemented

### Conversations
- Username-based sign-up and login, with no phone number or email requirement.
- Client-generated libsodium identities; passphrase-wrapped private keys; separate password-derived login credentials.
- Real-time, encrypted **one-to-one** text, photo, file, and voice-note envelopes over an authenticated SSE/HTTP relay.
- Search, replies, bookmarks, pinning, archives, mute controls, and relay-enforced contact blocking.
- Photo re-encoding to remove EXIF/GPS metadata; low-data mode uses a 960px maximum edge and JPEG quality 0.70. High quality uses 1920px / 0.88.
- File attachments up to 1 MB; voice recordings capped at two minutes. Recording depends on microphone permission and browser support.
- Optional outgoing expiration timers (1 hour, 24 hours, 7 days). They don't apply retroactively or prevent recipients keeping copies.
- Public identity QR cards and fingerprints, manual verification, and trust-on-first-use key pinning.
- Account locking and session revocation. Refreshing an authenticated browser requires passphrase unlock again.

### Twelve tools
Password generator · Text lock · Encrypted private notes · File vault · Photo metadata cleaner · Local URL inspector · Identity QR card · SHA-256 file fingerprint · Message timers · Session lock · Data saver · Security checklist.

Encryption tools use AES-256-GCM with PBKDF2-SHA256 at 600,000 iterations. Files and notes are processed on the device, not uploaded. This is **not** an independently reviewed vault format. Link inspection is a syntax check, not malware detection. Disappearing-message bookmarks still expire.

### Android shell
- Bundled local assets served under a synthetic HTTPS origin, not `file://`.
- Origin-restricted navigation and subresources, no mixed content, no bypass of TLS errors.
- Screenshots / recent-task snapshots disabled with `FLAG_SECURE`; app backup disabled.
- Storage Access Framework file selection and explicitly confirmed exports, without broad storage permissions.
- Microphone access requested only for user-initiated recording, and only for the trusted origin.
- A narrowly scoped native bridge for a relay configuration dialog and write-only, user-confirmed file export.
- No advertising or analytics SDKs. Platform WebView Safe Browsing may make its own platform-service requests.

### Honest boundaries
- Demo contacts and demo groups are fictional. Demo chats are **not E2EE**, use memory only, and are reset on reload. They are not bot-powered real conversations.
- Encrypted groups, audio/video calls, push delivery while the app is closed, multi-device key management, biometrics, and Tor routing are **not implemented**.
- Static crypto-box keys do **not** provide forward secrecy. A stolen private key may expose historical ciphertext.
- The relay learns contact pairs, message timing, size, expiry, account details, and network addresses. Hosting providers may also retain logs.
- No account/passphrase recovery flow exists. Losing a passphrase means losing access.
- Deleting or expiring records is not a guarantee of secure deletion from databases, backups, RAM, or recipients' devices.

## Build Android with the standard toolchain

Requirements: JDK 17, Android SDK platform 35, and Android SDK build tools. The Gradle 8.9 wrapper is included and verifies its distribution checksum.

```sh
npm ci
npm run build
npm run android:sync
./gradlew :app:assembleDebug :app:lintDebug
# app/build/outputs/apk/debug/app-debug.apk
```

To preconfigure a relay (the user can still change it in the native connection dialog):

```sh
./gradlew :app:assembleDebug -PcipherOrigin=https://your-cipher-server.example
```

The single `.github/workflows/build-apk.yml` workflow runs unit and browser tests, builds the client, bundles it, and uploads the Android debug APK. It runs on pull requests, `main`, and `arena/**` branch pushes. Check the pull request’s GitHub Actions results for the standard Gradle build and Android lint status.

For release distribution, use a **private release signing key**, deploy a hardened HTTPS backend, arrange independent application/protocol review, and replace the static-key messaging design with a reviewed production protocol. Do not treat a successful build as a security audit.

## Tests

```sh
npm test                        # crypto, tampering, authentication, authorization, relay
npm run typecheck
npx playwright install chromium
npm run test:e2e                # desktop/mobile, vault tools, two real accounts, images, lock/unlock
npm run build
```

In a sandbox where the Playwright CDN isn't reachable:

```sh
CIPHER_BUNDLED_BROWSER=1 npm run test:e2e
```

The fallback browser is a development-only dependency. Tests use a separate `.data/e2e` database and port 5174, not the user's development database. Neither test data nor downloaded build tools belong in Git.

## Deploy the relay

```sh
npm ci
npm run build
NODE_ENV=production APP_ORIGIN=https://your-cipher-server.example \
  CIPHER_DATA_DIR=/private/path/cipher-data PORT=3001 npm start
```

Put port 3001 behind a trusted HTTPS reverse proxy. The app trusts **one** proxy hop; don't expose it directly with forgeable forwarded headers. Forward the original Host and HTTPS information, disable proxy buffering on `/api/events`, allow long-lived SSE connections, and set appropriate connection/body limits. In production the session cookie is `HttpOnly; Secure; SameSite=Strict`, and state-changing requests require a same-origin JSON request with the app verification header. Do not log request bodies, credential proofs, cookies, private keys, or plaintext.

Production responses include a restrictive content security policy. Frame restrictions are omitted for embedded preview compatibility; a standalone deployment should add an appropriate `frame-ancestors` policy at its proxy. Enforce quotas, monitoring, backup policies, dependency updates, and independent review before considering any real deployment.

SQLite data goes to `.data/` by default, outside the served `dist/` directory. Usernames, names, public keys, encrypted private-key bundles, scrypt verifiers, hashed session tokens, ciphertext, and necessary routing metadata are stored. This relay does not claim anonymous or decentralized transport.

## Project structure

```text
web/                    React / TypeScript client, styles, bundled media
web/src/lib/crypto.mjs   libsodium boxes, passphrase wrapping, local vault tools
server/                 Same-origin Express relay, SQLite, sessions, SSE
tests/                  Node crypto/API tests and Playwright end-to-end tests
app/                    Minimal origin-restricted Android WebView shell
scripts/                Android asset sync and sandbox browser helper
releases/               Requested debug APK, checksum, verification report
```

Fonts, sample photos, and a small emoji subset are served locally. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for attribution.
