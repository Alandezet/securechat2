# Threat model — Cipher prototype

## Intended use

A testable, low-bandwidth UX and engineering prototype. Local demonstrations and non-sensitive evaluation only. This is not an alternative to a mature, independently reviewed high-risk messenger.

## Assets

Account passphrases, private identity keys, decrypted messages/attachments, contact identity integrity, and account authorization. Names, usernames, routing relationships, key fingerprints, sizes, timing, and network addresses are not anonymous.

## Boundaries

- The browser/Android WebView, OS, input method, bundled code, dependencies, and HTTPS origin must be trusted.
- The relay is untrusted for message plaintext but trusted to initially distribute public keys and serve web code. Manual fingerprint comparison and subsequent pinning mitigate **some**, not all, key-substitution risks.
- A contact who can decrypt can also save, forward, photograph, or forge their own local transcript. Authenticated boxes aren't transferable signatures or proof to a third party.
- HTTPS and correctly managed sessions protect access to the relay API. Public/private key authentication protects the content construction separately from account authentication.
- Local tools keep data on-device but have not been independently audited. Exported plaintext is outside protection; encrypted exports depend on the chosen passphrase.

## In scope for tests

Correct round-trip encryption, fresh nonces, rejection of wrong keys, ciphertext/header tampering, malformed attachment URLs, private-key wrapping, separation of login credentials, server-side session and sender authorization, ciphertext-only relay storage, blocking, expiry filtering, desktop/mobile account flows, local vault encryption, encrypted cross-account delivery, and photo attachment round-trips.

## Explicitly out of scope / unresolved

State-level attacks; targeted device exploitation; malicious OS/keyboard/accessibility services; root; side channels; stolen static private keys (no forward secrecy); coercion; compromised contacts; traffic analysis; malicious initial key distribution; compromised web origin/build pipeline; proof of memory/disk erasure; hardened release signing; reproducible native releases; push delivery; audited groups/calls; phishing-resistant authentication; post-quantum security; availability against relay censorship or denial of service.

An adversary controlling the origin can replace the JS and steal keys/passphrases. A compromised static key can expose historic messages. Metadata remains exposed even when message content is correctly encrypted. **Do not describe this prototype as nation-state resistant.**
