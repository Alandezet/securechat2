# SecureChat v1.0 prototype security model

This prototype combines device identity, authenticated-profile signatures, an ephemeral P-256 ECDH session, HKDF-SHA-256 key derivation, AES-256-GCM message encryption, and ntfy as a ciphertext relay.

The relay is intentionally treated as untrusted transport. ntfy supports HTTP publish and streaming subscriptions; SecureChat sends ciphertext rather than plaintext once a session is established.

Important limitations:
- This is a prototype, not a security-audited messenger.
- The UI currently requires manual peer public-key exchange.
- It does not yet implement a complete Signal Double Ratchet, multi-device state machine, sealed-sender design, or robust background notification service.
- Metadata such as topic names, timing, message size, and network addresses are not hidden by E2EE.
- Do not use it for genuinely sensitive communications until independently reviewed.
