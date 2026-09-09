# SecureChat

A security-first Android E2EE chat experiment.

## Current status: v0.1

This first build is intentionally small:

- Android/Kotlin/Jetpack Compose foundation
- Working local chat UI
- Android Keystore-backed AES-256-GCM local encryption building block
- No server
- No plaintext credentials or cryptographic secrets in the repository
- GitHub Actions APK build

## Security warning

This is an experimental project, **not a production-secure messenger**.

The local AES-GCM class is only a building block. The real multi-device, end-to-end messaging protocol will use an established, reviewed protocol design rather than homemade cryptography.

Planned protocol work:

1. Cryptographic identity keys
2. Signed identity/pre-key records
3. Authenticated key agreement
4. Double Ratchet-style message key evolution
5. Forward secrecy and post-compromise recovery
6. Decentralized relays
7. Encrypted media
8. Metadata minimization
9. Security tests and external review

## Build

The GitHub Actions workflow builds a debug APK without requiring a Gradle wrapper in the repository.

For local development, use Android Studio with JDK 17.

## License

To be decided.
