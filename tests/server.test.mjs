import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../server/app.mjs'
import { createIdentity, deriveCredential, encryptMessage, decryptMessage } from '../web/src/lib/crypto.mjs'
let relay, server, root, alice, bob
async function request(path, { method = 'GET', body, cookie, headers = {} } = {}) {
  const response = await fetch(root + '/api' + path, { method, headers: { 'Content-Type': 'application/json', 'X-Cipher-Client': '1', ...(cookie ? { Cookie: cookie } : {}), ...headers }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) })
  return { status: response.status, body: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0], headers: response.headers }
}
async function register(username) {
  const passphrase = `this is ${username}'s unique test passphrase`
  const identity = await createIdentity(username, passphrase)
  const credential = await deriveCredential(username, passphrase)
  const result = await request('/auth/register', { method: 'POST', body: { username, name: username, publicKey: identity.publicKey, wrappedKey: identity.wrappedKey, credential } })
  assert.equal(result.status, 201)
  return { ...result, ...identity, credential, user: result.body.user }
}
before(async () => {
  relay = createApp({ database: ':memory:', disableLimits: true })
  server = relay.app.listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  root = `http://127.0.0.1:${server.address().port}`
  alice = await register('test_alice'); bob = await register('test_bob')
})
after(async () => { relay.close(); await new Promise(resolve => server.close(resolve)) })

test('authentication protects the directory, messages, and events', async () => {
  for (const path of ['/users?q=test', '/messages', '/events']) assert.equal((await request(path)).status, 401)
  const me = await request('/auth/me', { cookie: alice.cookie })
  assert.equal(me.body.user.username, 'test_alice')
  assert.equal(me.body.user.verifier, undefined)
  assert.equal(me.headers.get('cache-control'), 'no-store')
})
test('duplicate registration and invalid cryptographic account data are rejected', async () => {
  const body = { username: 'test_alice', name: 'Alice', credential: alice.credential, publicKey: alice.publicKey, wrappedKey: alice.wrappedKey }
  assert.equal((await request('/auth/register', { method: 'POST', body })).status, 409)
  assert.equal((await request('/auth/register', { method: 'POST', body: { ...body, username: 'different', publicKey: 'bad' } })).status, 400)
})
test('login rejects bad credentials; relay stores a slow verifier instead of a bearer credential', async () => {
  const result = await request('/auth/login', { method: 'POST', body: { username: 'test_alice', credential: alice.credential } })
  assert.equal(result.status, 200); assert.deepEqual(result.body.wrappedKey, alice.wrappedKey)
  assert.equal((await request('/auth/login', { method: 'POST', body: { username: 'test_alice', credential: '0'.repeat(64) } })).status, 401)
  const row = relay.db.prepare('SELECT * FROM users WHERE username=?').get('test_alice')
  assert.notEqual(row.verifier, alice.credential); assert.equal(row.verifier.length, 128)
})
test('directory lookup is bounded and exposes public information only', async () => {
  const result = await request('/users?q=test_b', { cookie: alice.cookie })
  assert.equal(result.status, 200); assert.equal(result.body.users.length, 1)
  assert.equal(result.body.users[0].id, bob.user.id)
  assert.deepEqual(Object.keys(result.body.users[0]).sort(), ['id', 'name', 'username', 'publicKey'].sort())
  assert.deepEqual((await request('/users?q=%', { cookie: alice.cookie })).body.users, [])
})
let message
test('encrypted messages relay to the other account and are not stored as plaintext', async () => {
  const header = { id: crypto.randomUUID(), sender: alice.user.id, recipient: bob.user.id, expiresAt: null }
  const box = await encryptMessage({ type: 'text', text: 'this plaintext must never reach SQLite' }, header, alice.keys.privateKey, bob.publicKey)
  const result = await request('/messages', { method: 'POST', cookie: alice.cookie, body: box })
  assert.equal(result.status, 201); message = result.body.message
  const received = await request('/messages', { cookie: bob.cookie })
  const body = await decryptMessage(received.body.messages[0], bob.keys.privateKey, alice.publicKey)
  assert.equal(body.text, 'this plaintext must never reach SQLite')
  const rows = relay.db.prepare('SELECT * FROM messages').all()
  assert.equal(JSON.stringify(rows).includes(body.text), false)
  assert.equal((await request('/messages', { method: 'POST', cookie: alice.cookie, body: box })).status, 409)
})
test('message deletion requires the sender and removes relay history', async () => {
  assert.equal((await request(`/messages/${message.id}`, { method: 'DELETE', cookie: bob.cookie })).status, 404)
  assert.equal((await request(`/messages/${message.id}`, { method: 'DELETE', cookie: alice.cookie })).status, 200)
  assert.equal((await request('/messages', { cookie: bob.cookie })).body.messages.length, 0)
})
test('block is enforced on the relay, in both directions', async () => {
  const payload = { id: crypto.randomUUID(), recipient: alice.user.id, nonce: Buffer.alloc(24).toString('base64'), ciphertext: Buffer.alloc(32).toString('base64'), expiresAt: null }
  assert.equal((await request(`/blocks/${bob.user.id}`, { method: 'POST', cookie: alice.cookie, body: {} })).status, 200)
  assert.equal((await request('/messages', { method: 'POST', cookie: bob.cookie, body: payload })).status, 403)
  assert.equal((await request(`/blocks/${bob.user.id}`, { method: 'DELETE', cookie: alice.cookie })).status, 200)
})
test('expired messages are excluded from sync and unreasonable expirations rejected', async () => {
  const id = crypto.randomUUID()
  relay.db.prepare('INSERT INTO messages VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, alice.user.id, bob.user.id, 'nonce', 'ciphertext', Date.now() - 2000, Date.now() - 1000)
  assert.equal((await request('/messages', { cookie: bob.cookie })).body.messages.length, 0)
  const result = await request('/messages', { method: 'POST', cookie: alice.cookie, body: { id: crypto.randomUUID(), recipient: bob.user.id, nonce: Buffer.alloc(24).toString('base64'), ciphertext: Buffer.alloc(32).toString('base64'), expiresAt: Date.now() + 1000 } })
  assert.equal(result.status, 400)
})
test('cross-origin state changes fail even with a valid session cookie', async () => {
  const result = await request('/auth/logout', { method: 'POST', cookie: alice.cookie, body: {}, headers: { Origin: 'https://malicious.example', 'Sec-Fetch-Site': 'cross-site' } })
  assert.equal(result.status, 403)
  assert.equal((await request('/auth/me', { cookie: alice.cookie })).status, 200)
})
test('logout revokes the session rather than only hiding the UI', async () => {
  assert.equal((await request('/auth/logout', { method: 'POST', cookie: bob.cookie, body: {} })).status, 200)
  assert.equal((await request('/auth/me', { cookie: bob.cookie })).status, 401)
})
