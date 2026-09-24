# Cipher 0.2 prototype — security boundaries

**Not audited. Do not use for high-risk, journalistic, activist, classified, or similarly sensitive communications. No protection against a state-level adversary is promised.** A modern UI and standard cryptographic primitives are not a substitute for a reviewed protocol, implementation, and operational deployment.

## Implemented protections

- Account identity keys are generated client-side using `libsodium-wrappers` 0.7.15 `crypto_box_keypair` (X25519).
- One-to-one messages use libsodium `crypto_box_easy` with fresh 24-byte nonces (X25519 + XSalsa20-Poly1305). Both participants can derive the same authenticated box key. There are **no per-message cleartext keysets** in envelopes.
- Authenticated encrypted content includes the protocol version and routing/expiry header. The receiver rejects mismatched IDs, sender, recipient, or expiration, malformed attachment types, and untrusted remote image URLs.
- Private identity keys are wrapped with AES-256-GCM using PBKDF2-SHA256, 600,000 iterations, a random 16-byte salt and 12-byte nonce. AAD binds username and public key. Unwrapping checks that the private key matches the advertised public key.
- A separate, username/domain-separated PBKDF2 credential is used for login. The server stores a scrypt verifier (N=32768, r=8, p=1), not the passphrase or that bearer credential. TLS is mandatory outside local development.
- Session cookies are HttpOnly, SameSite=Strict, and Secure in production. Session tokens are random 256-bit values, stored by hash, with a 24-hour expiration. Logout revokes sessions, and connected clients receive a revocation event.
- State-changing API calls require the app header and same-origin checks. There are body limits, account/login/message request rate limits, authorization checks, and bounded username lookups.
- Real message plaintext and unlocked identity keys are kept in memory, not in localStorage. Public-key pins and preference flags can be stored there. Logout/lock clears account message state and overwrites the active private-key byte array.
- The client pins public keys on first contact. Subsequent changed pinned keys block decryption. A human must compare complete fingerprints through a trusted channel before marking an identity verified.
- Photos are re-encoded rather than sending their original EXIF metadata. Arbitrary files are not inspected for embedded metadata, viruses, or secrets. No remote link previews or analytics are loaded by the client.
- Android uses restricted HTTPS origins, no cleartext/mixed content or TLS bypass, disabled app backup and screenshots, user-selected file access, and a write-only export bridge requiring a system save dialog. The bridge does not expose files, credentials, or keys to JavaScript.

## Important non-guarantees

1. **No forward secrecy or post-compromise security.** Static identity keys are used. A compromised key can expose past and future stored ciphertext. There is no Double Ratchet, prekey/X3DH protocol, or PQXDH.
2. **No first-contact key transparency.** The relay supplies the first public key. Pinning cannot defeat a malicious initial key substitution; manual verification is required.
3. **No metadata anonymity.** The relay sees account identities, contact pairs, sizes, timing, expiration and network addresses. Public-key lookup is prefix-searchable. Infrastructure can log additional metadata.
4. **Web delivery trusts the server.** A compromised origin can replace the JavaScript, defeat the E2EE implementation, and steal passphrases. Bundled offline Android assets reduce remote code delivery only while in offline mode; connecting to an HTTPS deployment loads its client code.
5. **A compromised endpoint wins.** Root, malware, accessibility abuse, a malicious keyboard, unlocked memory, a compromised contact, and screen recording on another endpoint are outside the protection model.
6. **No secure-erasure guarantee.** Clearing arrays and UI is best effort in JavaScript. GC copies, process memory, clipboard history, SQL pages, relay backups, recipients' copies and screenshots can survive deletion. Timer cleanup removes active rows every ~30 seconds; clients hide expired messages every ~5 seconds.
7. **No native Keystore / biometrics.** This version is a restricted WebView client, not a hardware-bound identity design. The old broken Keystore / Tink scaffolding and contradictory alternate protocol were removed rather than represented as working protection.
8. **No production group protocol, call protocol, push delivery or multi-device ratchet.** Sample groups are local demonstrations only. Voice notes are encrypted attachments, not voice calls.
9. **No recovery.** A forgotten passphrase cannot be reset. No recovery key or escrow is implemented. Deleting browser storage also deletes locally recorded verification and pins.
10. **No audited release artifact.** The provided APK uses a known debug signing key. It was compiled and its signature/manifest checked, not tested on physical hardware or an Android emulator. Release signing, reproducible release verification, supply-chain review, and independent review are still required.

## Operational notes

The production relay must be behind a trusted HTTPS proxy. It trusts one forwarding hop. Frame-ancestor restrictions are intentionally absent to permit Arena previews; configure them for a standalone deployment. Set `APP_ORIGIN`, restrict database file access, protect backups, disable body/cookie logging, configure connection quotas, and monitor abuse. Do not infer mobile billing from approximate client ciphertext counters.

Native WebView Safe Browsing is enabled and may contact platform services independently of the application's own self-hosted assets. Screenshot prevention is Android-only and does not prevent photographing a screen.

## Reporting

Report implementation defects privately to the repository maintainer through an available GitHub security-reporting channel. Do not post real conversations, private keys, passphrases, cookies, or credential proofs in public issues. This project currently has no established incident-response SLA.
