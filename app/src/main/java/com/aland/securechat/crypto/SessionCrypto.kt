package com.aland.securechat.crypto

import android.util.Base64
import java.nio.charset.StandardCharsets
import java.security.KeyFactory
import java.security.KeyPair
import java.security.KeyPairGenerator
import java.security.MessageDigest
import java.security.PrivateKey
import java.security.PublicKey
import java.security.Signature
import java.security.spec.ECGenParameterSpec
import java.security.spec.X509EncodedKeySpec
import javax.crypto.Cipher
import javax.crypto.KeyAgreement
import javax.crypto.Mac
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

object SessionCrypto {
    data class Ephemeral(val pair: KeyPair, val publicB64: String)
    data class Box(val nonceB64: String, val cipherB64: String)

    fun newEphemeral(): Ephemeral {
        val g = KeyPairGenerator.getInstance("EC")
        g.initialize(ECGenParameterSpec("secp256r1"))
        val p = g.generateKeyPair()
        return Ephemeral(p, b64(p.public.encoded))
    }

    fun publicFromB64(value: String): PublicKey {
        val bytes = Base64.decode(value, Base64.DEFAULT)
        return KeyFactory.getInstance("EC").generatePublic(X509EncodedKeySpec(bytes))
    }

    fun sharedKey(privateKey: PrivateKey, peerPublic: PublicKey, transcript: String): ByteArray {
        val ka = KeyAgreement.getInstance("ECDH")
        ka.init(privateKey)
        ka.doPhase(peerPublic, true)
        val secret = ka.generateSecret()
        return hkdfSha256(secret, transcript.toByteArray(StandardCharsets.UTF_8), "SecureChat/v1 session".toByteArray(), 32)
    }

    fun encrypt(key: ByteArray, plaintext: String, aad: String): Box {
        val nonce = ByteArray(12).also { java.security.SecureRandom().nextBytes(it) }
        val c = Cipher.getInstance("AES/GCM/NoPadding")
        c.init(Cipher.ENCRYPT_MODE, SecretKeySpec(key, "AES"), GCMParameterSpec(128, nonce))
        c.updateAAD(aad.toByteArray(StandardCharsets.UTF_8))
        val out = c.doFinal(plaintext.toByteArray(StandardCharsets.UTF_8))
        return Box(b64(nonce), b64(out))
    }

    fun decrypt(key: ByteArray, box: Box, aad: String): String {
        val c = Cipher.getInstance("AES/GCM/NoPadding")
        c.init(Cipher.DECRYPT_MODE, SecretKeySpec(key, "AES"), GCMParameterSpec(128, Base64.decode(box.nonceB64, Base64.DEFAULT)))
        c.updateAAD(aad.toByteArray(StandardCharsets.UTF_8))
        return String(c.doFinal(Base64.decode(box.cipherB64, Base64.DEFAULT)), StandardCharsets.UTF_8)
    }

    fun sign(privateKey: PrivateKey, text: String): String {
        val s = Signature.getInstance("SHA256withECDSA")
        s.initSign(privateKey)
        s.update(text.toByteArray(StandardCharsets.UTF_8))
        return b64(s.sign())
    }

    fun verify(publicKey: PublicKey, text: String, signatureB64: String): Boolean {
        val s = Signature.getInstance("SHA256withECDSA")
        s.initVerify(publicKey)
        s.update(text.toByteArray(StandardCharsets.UTF_8))
        return s.verify(Base64.decode(signatureB64, Base64.DEFAULT))
    }

    fun fingerprint(publicKey: PublicKey): String {
        return MessageDigest.getInstance("SHA-256").digest(publicKey.encoded).joinToString("") { "%02x".format(it) }
    }

    private fun hkdfSha256(ikm: ByteArray, salt: ByteArray, info: ByteArray, len: Int): ByteArray {
        val mac = Mac.getInstance("HmacSHA256")
        mac.init(SecretKeySpec(salt, "HmacSHA256"))
        val prk = mac.doFinal(ikm)
        var t = ByteArray(0)
        val out = ByteArray(len)
        var pos = 0
        var counter = 1
        while (pos < len) {
            mac.init(SecretKeySpec(prk, "HmacSHA256"))
            mac.update(t)
            mac.update(info)
            mac.update(counter.toByte())
            t = mac.doFinal()
            val n = minOf(t.size, len - pos)
            System.arraycopy(t, 0, out, pos, n)
            pos += n
            counter++
        }
        return out
    }

    fun b64(bytes: ByteArray): String = Base64.encodeToString(bytes, Base64.NO_WRAP)
}
