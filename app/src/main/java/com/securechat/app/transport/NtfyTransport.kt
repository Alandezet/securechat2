package com.securechat.app.transport

import com.securechat.app.model.EncryptedMessagePacket
import okhttp3.*
import java.io.IOException

class NtfyTransport(private val serverUrl: String = "https://ntfy.sh") {

    private val client = OkHttpClient()

    fun sendMessage(packet: EncryptedMessagePacket, callback: (Boolean) -> Unit) {
        val url = "$serverUrl/${packet.recipientTopic}"
        val request = Request.Builder()
            .url(url)
            .post(RequestBody.create(MediaType.parse("text/plain"), packet.toJson()))
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                callback(false)
            }
            override fun onResponse(call: Call, response: Response) {
                callback(response.isSuccessful)
            }
        })
    }

    fun listenToTopic(topic: String, onMessageReceived: (EncryptedMessagePacket) -> Unit) {
        val url = "$serverUrl/$topic/json"
        val request = Request.Builder().url(url).build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {}
            override fun onResponse(call: Call, response: Response) {
                response.body()?.byteStream()?.bufferedReader()?.use { reader ->
                    while (true) {
                        val line = reader.readLine() ?: break
                        if (line.contains("message")) {
                            try {
                                val jsonStr = org.json.JSONObject(line).optString("message", "")
                                if (jsonStr.isNotEmpty()) {
                                    val packet = EncryptedMessagePacket.fromJson(jsonStr)
                                    onMessageReceived(packet)
                                }
                            } catch (e: Exception) {
                                // Invalid payload dropped
                            }
                        }
                    }
                }
            }
        })
    }
}
