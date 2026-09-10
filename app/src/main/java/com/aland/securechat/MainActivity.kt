package com.aland.securechat

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.aland.securechat.crypto.SessionCrypto
import com.aland.securechat.identity.IdentityManager
import com.aland.securechat.transport.NtfyClient
import java.util.UUID
import java.util.concurrent.Executors

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) { super.onCreate(savedInstanceState); setContent { App() } }
}

data class UiMsg(val text: String, val mine: Boolean)

@Composable
private fun App() {
    val context = androidx.compose.ui.platform.LocalContext.current
    val identity = remember { IdentityManager(context) }
    val ntfy = remember { NtfyClient() }
    val executor = remember { Executors.newSingleThreadExecutor() }
    var topic by remember { mutableStateOf("sc-demo-${UUID.randomUUID().toString().replace("-", "")}") }
    var peerKey by remember { mutableStateOf("") }
    var message by remember { mutableStateOf("") }
    var status by remember { mutableStateOf("Create a session with a peer public key") }
    var sessionKey by remember { mutableStateOf<ByteArray?>(null) }
    val messages = remember { mutableStateListOf<UiMsg>() }

    DisposableEffect(Unit) { onDispose { executor.shutdownNow() } }

    MaterialTheme {
        Surface(Modifier.fillMaxSize()) {
            Column(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("SecureChat", style = MaterialTheme.typography.headlineMedium)
                Text("v1.0 prototype • identity + ECDH + AES-GCM + ntfy")
                Text("Your fingerprint: ${identity.fingerprint()}", style = MaterialTheme.typography.bodySmall)
                OutlinedTextField(topic, { topic = it }, Modifier.fillMaxWidth(), label = { Text("ntfy mailbox topic") }, singleLine = true)
                OutlinedTextField(peerKey, { peerKey = it }, Modifier.fillMaxWidth(), label = { Text("Peer public key (base64)") }, minLines = 2)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(onClick = {
                        try {
                            val eph = SessionCrypto.newEphemeral()
                            val peer = SessionCrypto.publicFromB64(peerKey.trim())
                            val transcript = "SecureChat/v1|${identity.publicKeyBase64()}|$peerKey|${eph.publicB64}"
                            sessionKey = SessionCrypto.sharedKey(eph.pair.private, peer, transcript)
                            status = "Session key established locally. Verify fingerprints out-of-band before trusting a peer."
                        } catch (e: Exception) { status = "Key exchange error: ${e.message}" }
                    }) { Text("Establish") }
                    Button(onClick = {
                        val current = topic
                        executor.execute {
                            try { val code = ntfy.publish(current, "SC1|${identity.publicKeyBase64()}"); runOnUiThread { status = "ntfy response: $code" } }
                            catch (e: Exception) { runOnUiThread { status = "ntfy error: ${e.message}" } }
                        }
                    }) { Text("Ping relay") }
                }
                Text(status, style = MaterialTheme.typography.bodySmall)
                HorizontalDivider()
                LazyColumn(Modifier.weight(1f).fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    items(messages) { m -> Card(Modifier.fillMaxWidth()) { Text(if (m.mine) "You: ${m.text}" else "Peer: ${m.text}", Modifier.padding(10.dp)) } }
                }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(message, { message = it }, Modifier.weight(1f), singleLine = true, label = { Text("Message") })
                    Button(enabled = sessionKey != null, onClick = {
                        val key = sessionKey ?: return@Button
                        if (message.isBlank()) return@Button
                        try {
                            val aad = "SecureChat/v1|$topic|${messages.size}"
                            val box = SessionCrypto.encrypt(key, message, aad)
                            val wire = "SC1|$aad|${box.nonceB64}|${box.cipherB64}"
                            executor.execute {
                                try { val code = ntfy.publish(topic, wire); runOnUiThread { messages.add(UiMsg(message, true)); message = ""; status = "Encrypted ciphertext sent. HTTP $code" } }
                                catch (e: Exception) { runOnUiThread { status = "Send error: ${e.message}" } }
                            }
                        } catch (e: Exception) { status = "Encryption error: ${e.message}" }
                    }) { Text("Send") }
                }
                Text("Prototype warning: this is not audited and does not yet implement a full Signal-style Double Ratchet. Do not use for high-stakes secrets.", style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}
