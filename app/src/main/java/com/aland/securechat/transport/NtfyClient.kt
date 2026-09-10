package com.aland.securechat.transport

import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL
import java.nio.charset.StandardCharsets
import java.net.URLEncoder

class NtfyClient(private val baseUrl: String = "https://ntfy.sh") {
    fun publish(topic: String, ciphertext: String): Int {
        val c = (URL("${baseUrl.trimEnd('/')}/${encode(topic)}").openConnection() as HttpURLConnection)
        c.requestMethod = "POST"
        c.doOutput = true
        c.connectTimeout = 10000
        c.readTimeout = 10000
        c.setRequestProperty("Content-Type", "text/plain; charset=utf-8")
        c.outputStream.use { it.write(ciphertext.toByteArray(StandardCharsets.UTF_8)) }
        val code = c.responseCode
        c.disconnect()
        return code
    }

    fun stream(topic: String): BufferedReader {
        val c = (URL("${baseUrl.trimEnd('/')}/${encode(topic)}/json").openConnection() as HttpURLConnection)
        c.requestMethod = "GET"
        c.connectTimeout = 15000
        c.readTimeout = 0
        if (c.responseCode !in 200..299) throw IllegalStateException("ntfy HTTP ${c.responseCode}")
        return BufferedReader(InputStreamReader(c.inputStream, StandardCharsets.UTF_8))
    }

    private fun encode(s: String) = URLEncoder.encode(s, StandardCharsets.UTF_8.name())
}
