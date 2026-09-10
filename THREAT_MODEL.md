# SecureChat Threat Model

## Assumptions & Guarantees
- **Untrusted Transport:** Network relays may record, delay, or duplicate messages. All content is protected using AEAD.
- **Identity:** Device identity relies on non-exportable hardware private keys (`AndroidKeyStore`).

## Explicit Non-Guarantees
- Physical extraction from root-compromised Android OS devices.
- Traffic side-channel metadata analysis (relays see timing/volume).
