# SecureChat v1.0 Prototype

Zero-Trust, Decentralized 1-to-1 Encrypted Messenger built on Android Jetpack Compose, Google Tink, and `ntfy.sh`.

## Architecture Highlights
- **No Central Server:** Uses public pub/sub relays (`ntfy.sh`) as completely untrusted transport.
- **Hardware Identity:** Hardware-backed Keystore secp256r1 keys.
- **Zero Metadata Exposure:** Transmits AEAD authenticated ciphertext envelopes only.

## Building on GitHub / Termux
1. Run `./gradlew assembleDebug` or push to GitHub.
2. Download the APK artifact directly from the automated GitHub Actions run.
