package com.securechat.app.identity

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.MessageDigest
import java.security.Signature
import java.util.Base64

class IdentityManager {

    private val KEY_ALIAS = "SecureChatIdentityECDSA"
    private val ANDROID_KEYSTORE = "AndroidKeyStore"

    init {
        ensureIdentityExists()
    }

    private fun ensureIdentityExists() {
        val ks = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
        if (!ks.containsAlias(KEY_ALIAS)) {
            val kpg = KeyPairGenerator.getInstance(
                KeyProperties.KEY_ALGORITHM_EC, ANDROID_KEYSTORE
            )
            val parameterSpec = KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_SIGN or KeyProperties.PURPOSE_VERIFY
            ).run {
                setDigits(256)
                setDigestAlgorithms(KeyProperties.DIGEST_SHA256)
                build()
            }
            kpg.initialize(parameterSpec)
            kpg.generateKeyPair()
        }
    }

    fun getPublicKeyPem(): String {
        val ks = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
        val cert = ks.getCertificate(KEY_ALIAS)
        return Base64.getEncoder().encodeToString(cert.publicKey.encoded)
    }

    fun getFingerprint(): String {
        val pubKeyBytes = Base64.getDecoder().decode(getPublicKeyPem())
        val digest = MessageDigest.getInstance("SHA-256").digest(pubKeyBytes)
        return digest.joinToString(":") { "%02X".format(it) }
    }

    fun signData(data: ByteArray): ByteArray {
        val ks = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
        val entry = ks.getEntry(KEY_ALIAS, null) as KeyStore.PrivateKeyEntry
        val signer = Signature.getInstance("SHA256withECDSA").apply {
            initSign(entry.privateKey)
            update(data)
        }
        return signer.sign()
    }

    private fun setDigits(size: Int) {} // Helper fallback for Builder mapping
}
