package com.aland.securechat.identity

import android.content.Context
import android.util.Base64
import java.nio.charset.StandardCharsets
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.MessageDigest
import java.security.PrivateKey
import java.security.Signature
import java.security.spec.ECGenParameterSpec

/**
 * Device-bound cryptographic identity for SecureChat.
 * The private signing key stays inside Android Keystore.
 *
 * This is the identity layer, not the final messaging protocol.
 */
class IdentityManager(context: Context) {
    companion object {
        private const val KEYSTORE = "AndroidKeyStore"
        private const val ALIAS = "securechat.identity.signing.v1"
        private const val PREFS = "securechat.identity"
        private const val PUBLIC_KEY = "public_key"
        private const val CURVE = "secp256r1"
    }

    private val prefs =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    private fun keyStore(): KeyStore =
        KeyStore.getInstance(KEYSTORE).apply { load(null) }

    private fun ensureKeyPair() {
        val ks = keyStore()
        if (ks.containsAlias(ALIAS)) return

        val generator = KeyPairGenerator.getInstance("EC", KEYSTORE)
        generator.initialize(ECGenParameterSpec(CURVE))
        val pair = generator.generateKeyPair()

        prefs.edit()
            .putString(PUBLIC_KEY, b64(pair.public.encoded))
            .apply()
    }

    private fun privateKey(): PrivateKey {
        ensureKeyPair()
        return keyStore().getKey(ALIAS, null) as PrivateKey
    }

    fun publicKeyBase64(): String {
        ensureKeyPair()
        return prefs.getString(PUBLIC_KEY, null)
            ?: error("Identity public key is missing")
    }

    fun fingerprint(): String {
        val bytes = Base64.decode(publicKeyBase64(), Base64.NO_WRAP)
        val digest = MessageDigest.getInstance("SHA-256").digest(bytes)
        return digest.joinToString(":") { "%02X".format(it) }
    }

    /** Signs a canonical profile payload for later identity verification. */
    fun signProfile(username: String, createdAt: Long): String {
        val canonical =
            "SecureChatProfile/v1\nusername=$username\ncreatedAt=$createdAt"
                .toByteArray(StandardCharsets.UTF_8)

        val signer = Signature.getInstance("SHA256withECDSA")
        signer.initSign(privateKey())
        signer.update(canonical)
        return b64(signer.sign())
    }

    private fun b64(bytes: ByteArray): String =
        Base64.encodeToString(bytes, Base64.NO_WRAP)
}
