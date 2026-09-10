package com.securechat.app

import com.securechat.app.crypto.CryptoEngine
import com.securechat.app.model.EncryptedMessagePacket
import org.junit.Assert.*
import org.junit.Test

class SecureChatCryptoTest {

    @Test
    fun testEncryptionDecryptionFlow() {
        val crypto = CryptoEngine()
        val plaintext = "Top-Secret E2EE Communication payload"
        val assocData = "SENDER_FP_123456789".toByteArray()

        val (keyset, ciphertext) = crypto.encryptPayload(plaintext, assocData)
        assertNotNull(keyset)
        assertNotNull(ciphertext)

        val decrypted = crypto.decryptPayload(keyset, ciphertext, assocData)
        assertEquals(plaintext, decrypted)
    }

    @Test
    fun testTamperDetectionRejection() {
        val crypto = CryptoEngine()
        val plaintext = "Tamper Detection Test"
        val assocData = "VALID_ASSOC_DATA".toByteArray()
        val tamperedAssocData = "INVALID_ASSOC_DATA".toByteArray()

        val (keyset, ciphertext) = crypto.encryptPayload(plaintext, assocData)

        try {
            crypto.decryptPayload(keyset, ciphertext, tamperedAssocData)
            fail("Expected security exception on tampered associated data")
        } catch (e: Exception) {
            assertTrue(true)
        }
    }

    @Test
    fun testPacketSerialization() {
        val packet = EncryptedMessagePacket(
            senderFingerprint = "FP123",
            recipientTopic = "topic456",
            encryptedKeysetHandleBase64 = "kBase64",
            encryptedPayloadBase64 = "pBase64",
            sequenceNumber = 42L,
            timestamp = 100000L,
            signature = "sigBytes"
        )
        val json = packet.toJson()
        val deserialized = EncryptedMessagePacket.fromJson(json)

        assertEquals(packet.senderFingerprint, deserialized.senderFingerprint)
        assertEquals(packet.sequenceNumber, deserialized.sequenceNumber)
    }
}
