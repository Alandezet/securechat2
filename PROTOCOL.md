# SecureChat v1.0 Protocol Wire Specification

1. **Envelope Structure:**
   `EncryptedMessagePacket = { senderFingerprint, recipientTopic, encryptedKeysetHandleBase64, encryptedPayloadBase64, sequenceNumber, timestamp, signature }`
2. **Payload AEAD:**
   AES-128-GCM using ephemeral keys. Associated Data binds `senderFingerprint` + `sequenceNumber`.
