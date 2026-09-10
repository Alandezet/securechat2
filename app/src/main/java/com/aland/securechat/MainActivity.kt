package com.aland.securechat

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.aland.securechat.identity.IdentityManager

data class ChatMessage(val text: String, val mine: Boolean)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { SecureChatApp() }
    }
}

@Composable
private fun SecureChatApp() {
    val context = androidx.compose.ui.platform.LocalContext.current
    val identity = remember { IdentityManager(context) }

    var username by remember { mutableStateOf("Aland") }
    var profileSignature by remember { mutableStateOf<String?>(null) }
    var message by remember { mutableStateOf("") }
    val fingerprint = remember { identity.fingerprint() }

    val messages = remember {
        mutableStateListOf(
            ChatMessage("SecureChat v0.2", false),
            ChatMessage(
                "Identity key generated locally and protected by Android Keystore.",
                false
            )
        )
    }

    MaterialTheme {
        Surface(modifier = Modifier.fillMaxSize()) {
            Column(
                modifier = Modifier.fillMaxSize().padding(16.dp)
            ) {
                Text("SecureChat", style = MaterialTheme.typography.headlineMedium)
                Text(
                    "Cryptographic identity • v0.2.0",
                    style = MaterialTheme.typography.bodyMedium
                )

                Spacer(Modifier.height(12.dp))

                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Text(
                            "Your cryptographic identity",
                            style = MaterialTheme.typography.titleMedium
                        )
                        Spacer(Modifier.height(6.dp))
                        Text("Fingerprint", style = MaterialTheme.typography.labelMedium)
                        Text(fingerprint, style = MaterialTheme.typography.bodySmall)
                        Spacer(Modifier.height(8.dp))
                        OutlinedTextField(
                            value = username,
                            onValueChange = { username = it },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true,
                            label = { Text("Profile name") }
                        )
                        Spacer(Modifier.height(8.dp))
                        Button(onClick = {
                            profileSignature = identity.signProfile(
                                username.trim().ifBlank { "Aland" },
                                System.currentTimeMillis()
                            )
                        }) {
                            Text("Sign profile")
                        }
                        profileSignature?.let {
                            Spacer(Modifier.height(6.dp))
                            Text(
                                "Profile signed locally. Signature length: ${it.length} chars.",
                                style = MaterialTheme.typography.bodySmall
                            )
                        }
                    }
                }

                Spacer(Modifier.height(12.dp))

                LazyColumn(
                    modifier = Modifier.weight(1f).fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(messages) { item ->
                        Card(modifier = Modifier.fillMaxWidth()) {
                            Text(
                                if (item.mine) "You: ${item.text}"
                                else "SecureChat: ${item.text}",
                                modifier = Modifier.padding(12.dp)
                            )
                        }
                    }
                }

                Spacer(Modifier.height(8.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedTextField(
                        value = message,
                        onValueChange = { message = it },
                        modifier = Modifier.weight(1f),
                        singleLine = true,
                        label = { Text("Message") }
                    )
                    Button(onClick = {
                        if (message.isNotBlank()) {
                            messages.add(ChatMessage(message.trim(), true))
                            message = ""
                        }
                    }) {
                        Text("Send")
                    }
                }
            }
        }
    }
}
