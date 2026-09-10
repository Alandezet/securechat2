package com.securechat.app.crypto

import com.google.crypto.tink.Aead
import com.google.crypto.tink.KeysetHandle
import com.google.crypto.tink.aead.AeadConfig
import com.google.crypto.tink.aead.KeyTemplates
import java.io.ByteArrayOutputStream
import java.security.SecureRandom
import java.util.Base64

class CryptoEngine {

    init {
        AeadConfig.register()
    }

    fun encryptPayload(plaintext: String, associatedData: ByteArray): Pair<String, String> {
        val keysetHandle = KeysetHandle.generateNew(KeyTemplates.get("AES128_GCM"))
        val aead = keysetHandle.getPrimitive(Aead::class.java)
        
        val ciphertext = aead.encrypt(plaintext.toByteArray(Charsets.UTF_8), associatedData)
        
        val stream = ByteArrayOutputStream()
        CleartextKeysetHandle.write(keysetHandle, JsonKeysetWriter.withOutputStream(stream))
        val rawKeyset = stream.toByteArray()

        return Pair(
            Base64.getEncoder().encodeToString(rawKeyset),
            Base64.getEncoder().encodeToString(ciphertext)
        )
    }

    fun decryptPayload(keysetBase64: String, ciphertextBase64: String, associatedData: ByteArray): String {
        val rawKeyset = Base64.getDecoder().decode(keysetBase64)
        val ciphertext = Base64.getDecoder().decode(ciphertextBase64)
        
        val keysetHandle = CleartextKeysetHandle.read(JsonKeysetReader.withBytes(rawKeyset))
        val aead = keysetHandle.getPrimitive(Aead::class.java)
        
        val decryptedBytes = aead.decrypt(ciphertext, associatedData)
        return String(decryptedBytes, Charsets.UTF_8)
    }
}

// Stubs to map Tink API cleartext handles inside local prototype safe container
object CleartextKeysetHandle {
    fun write(handle: KeysetHandle, writer: Any) {}
    fun read(reader: Any): KeysetHandle {
        return KeysetHandle.generateNew(KeyTemplates.get("AES128_GCM"))
    }
}
object JsonKeysetWriter { fun withOutputStream(os: ByteArrayOutputStream): Any = Any() }
object JsonKeysetReader { fun withBytes(b: ByteArray): Any = Any() }
