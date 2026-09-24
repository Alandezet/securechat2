# Cipher box v1 — prototype wire format

This describes the implemented prototype, not a vetted messaging standard. The older SC1/ntfy/Tink-keyset protocol is no longer used.

## Account

`POST /api/auth/register` accepts `name`, a normalized `[a-z0-9_]{3,24}` username, a public X25519 key, a wrapped private-key bundle, and a password-derived authentication credential.

- Identity: libsodium `crypto_box_keypair`; 32-byte public/private keys.
- Login credential: 32 bytes from PBKDF2-SHA256(password, UTF8(`cipher-auth-v1:` + username), 210000), transmitted as lowercase hex over HTTPS. This is a bearer secret, despite not being the passphrase.
- Server verifier: scrypt(credential, random 32-byte hex salt, N=32768, r=8, p=1), 64 bytes. Constant-time comparison after derivation; a dummy KDF is performed for unknown usernames.
- Wrapping: PBKDF2-SHA256(password, random 16-byte salt, 600000) -> AES-256-GCM. Nonce is 12 random bytes, tag 128 bits. AAD is UTF8(`cipher-identity-v1:` + username + `:` + publicKeyBase64).
- Wrapped bundle: `{version:1,salt,iv,ciphertext}`, all byte arrays base64 with the standard alphabet. The 32-byte private key produces a 48-byte ciphertext/tag.

The relay stores the wrapped key and public key. Login returns that bundle only after authentication. The client decrypts it locally and checks the recovered key's public counterpart. There is no password change/recovery endpoint in this version.

## Message

Header:

```json
{"id":"random UUID","sender":"account UUID","recipient":"account UUID","expiresAt":null}
```

Encrypted plaintext is UTF-8 JSON:

```json
{
  "protocol": "cipher-box-v1",
  "header": {"id":"…","sender":"…","recipient":"…","expiresAt":null},
  "body": {"type":"text","text":"hello"}
}
```

The sender calls `crypto_box_easy(plaintext, randomNonce24, recipientPublicKey, senderPrivateKey)`. The outgoing envelope contains header fields, base64 nonce, and base64 authenticated ciphertext. The server sets the external sender from the authenticated session and appends an untrusted `createdAt` timestamp.

Supported body types: `text`, `image`, `file`, `voice`. Optional `data`, `name`, `size`, and `reply:{name,text}` are inside the ciphertext. Images are re-encoded JPEG data URLs; received images only allow JPEG/PNG/WebP data URLs. File downloads use application/octet-stream. Voice data is a browser-supported audio data URL. No attachment key, plaintext media, or externally fetched media URL is sent separately.

The recipient derives the box using its own private key and the pinned peer public key. It validates the encrypted protocol/header against every external routing/expiration field. The external `createdAt` is not authenticated and must not be trusted as proof of time or ordering.

The relay rejects duplicate message UUIDs, invalid body lengths, unsupported nonces, unauthorized deletion, blocked contact pairs, and timers beyond 7 days. It cannot validate the contents of ciphertext. Message fetches return the most recent 500 accessible, unexpired records; this is not a complete archival or pagination system.

## Transport

The same HTTPS origin serves the client and API. HttpOnly/SameSite cookies authenticate it. `GET /api/events` streams ciphertext events and a keepalive comment every 25 seconds; reconnect triggers an initial resynchronization. A successful send means **accepted by the relay**, not delivered to or read by a recipient. There are no read receipts or online-presence claims for real contacts.

Expiration is checked in reads and periodically purged. It is a retention convenience, not secure deletion. Only newly sent outgoing messages inherit the sender's timer. Blocking is enforced in both directions. Logout invalidates tokens and closes their streams.

## Local vault format

```json
{"format":"cipher-vault-v1","kdf":"PBKDF2-SHA256","iterations":600000,"salt":"…","iv":"…","ciphertext":"…"}
```

AES-256-GCM, PBKDF2-SHA256 at 600,000 iterations, random 16-byte salt, random 12-byte nonce, AAD `cipher-vault-v1`. The iteration count is fixed and checked before decrypting. Notes/files are never uploaded by the vault tool. This format, like the messaging construction around libsodium, is unaudited.

## What this protocol lacks

No ratchet, forward secrecy, prekeys, sealed sender, group key distribution, anonymous credentials, post-quantum exchange, key transparency, replay-resistant state synchronization against a malicious relay, or protection from replaced web client code. See SECURITY.md.
