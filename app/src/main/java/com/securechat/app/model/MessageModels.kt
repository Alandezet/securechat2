package com.securechat.app.model

import org.json.JSONObject
import java.util.Base64

data class IdentityRecord(
    val username: String,
    val publicKeyPem: String,
    val fingerprint: String,
    val signatureHex: String
) {
    fun toJson(): String {
        return JSONObject().apply {
            put("username", username)
            put("publicKeyPem", publicKeyPem)
            put("fingerprint", fingerprint)
            put("signatureHex", signatureHex)
        }.toString()
    }

    companion object {
        fun fromJson(jsonStr: String): IdentityRecord {
            val obj = JSONObject(jsonStr)
            return IdentityRecord(
                username = obj.getString("username"),
                publicKeyPem = obj.getString("publicKeyPem"),
                fingerprint = obj.getString("fingerprint"),
                signatureHex = obj.getString("signatureHex")
            )
        }
    }
}

data class EncryptedMessagePacket(
    val senderFingerprint: String,
    val recipientTopic: String,
    val encryptedKeysetHandleBase64: String,
    val encryptedPayloadBase64: String,
    val sequenceNumber: Long,
    val timestamp: Long,
    val signature: String
) {
    fun toJson(): String {
        return JSONObject().apply {
            put("senderFingerprint", senderFingerprint)
            put("recipientTopic", recipientTopic)
            put("encryptedKeysetHandleBase64", encryptedKeysetHandleBase64)
            put("encryptedPayloadBase64", encryptedPayloadBase64)
            put("sequenceNumber", sequenceNumber)
            put("timestamp", timestamp)
            put("signature", signature)
        }.toString()
    }

    companion object {
        fun fromJson(jsonStr: String): EncryptedMessagePacket {
            val obj = JSONObject(jsonStr)
            return EncryptedMessagePacket(
                senderFingerprint = obj.getString("senderFingerprint"),
                recipientTopic = obj.getString("recipientTopic"),
                encryptedKeysetHandleBase64 = obj.getString("encryptedKeysetHandleBase64"),
                encryptedPayloadBase64 = obj.getString("encryptedPayloadBase64"),
                sequenceNumber = obj.getLong("sequenceNumber"),
                timestamp = obj.getLong("timestamp"),
                signature = obj.getString("signature")
            )
        }
    }
}

data class ChatMessage(
    val id: String,
    val sender: String,
    val content: String,
    val timestamp: Long,
    val isMe: Boolean
)
