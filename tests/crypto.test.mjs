import test from 'node:test'
import assert from 'node:assert/strict'
import { createIdentity, unlockIdentity, deriveCredential, encryptMessage, decryptMessage, encryptVault, decryptVault, generatePassword, fingerprint } from '../web/src/lib/crypto.mjs'
const pass = 'a long unique test passphrase'
const alice = await createIdentity('alice', pass)
const bob = await createIdentity('bob', 'a different test passphrase')
const header = { id: crypto.randomUUID(), sender: 'alice', recipient: 'bob', expiresAt: null }
const body = { type: 'text', text: 'Only Alice and Bob should read this. 🌿' }
const encrypted = await encryptMessage(body, header, alice.keys.privateKey, bob.publicKey)

test('authenticated box decrypts at both participants, without a plaintext key in the envelope', async () => {
  assert.deepEqual(await decryptMessage(encrypted, bob.keys.privateKey, alice.publicKey), body)
  assert.deepEqual(await decryptMessage(encrypted, alice.keys.privateKey, bob.publicKey), body)
  assert.equal(JSON.stringify(encrypted).includes(body.text), false)
  assert.deepEqual(Object.keys(encrypted).sort(), ['id','sender','recipient','expiresAt','nonce','ciphertext'].sort())
})
test('wrong peer identity cannot open a message', async () => {
  await assert.rejects(decryptMessage(encrypted, bob.keys.privateKey, bob.publicKey))
})
test('tampered ciphertext and routing/expiry metadata are rejected', async () => {
  const raw = Buffer.from(encrypted.ciphertext, 'base64'); raw[20] ^= 1
  await assert.rejects(decryptMessage({ ...encrypted, ciphertext: raw.toString('base64') }, bob.keys.privateKey, alice.publicKey))
  for (const change of [{ id: crypto.randomUUID() }, { sender: 'mallory' }, { recipient: 'mallory' }, { expiresAt: 9999999999999 }]) {
    await assert.rejects(decryptMessage({ ...encrypted, ...change }, bob.keys.privateKey, alice.publicKey))
  }
})
test('each encryption has a fresh nonce', async () => {
  const other = await encryptMessage(body, header, alice.keys.privateKey, bob.publicKey)
  assert.notEqual(other.nonce, encrypted.nonce)
  assert.notEqual(other.ciphertext, encrypted.ciphertext)
})
test('private identity is passphrase-wrapped and public-key-bound', async () => {
  const unlocked = await unlockIdentity('alice', pass, alice.publicKey, alice.wrappedKey)
  assert.deepEqual(unlocked.privateKey, alice.keys.privateKey)
  await assert.rejects(unlockIdentity('alice', 'the wrong passphrase', alice.publicKey, alice.wrappedKey))
  await assert.rejects(unlockIdentity('bob', pass, alice.publicKey, alice.wrappedKey))
  await assert.rejects(unlockIdentity('alice', pass, bob.publicKey, alice.wrappedKey))
})
test('authentication credentials are domain separated by username', async () => {
  assert.notEqual(await deriveCredential('alice', pass), await deriveCredential('bob', pass))
  assert.equal(await deriveCredential('ALICE', pass), await deriveCredential('alice', pass))
})
test('vault round trips binary data and rejects a wrong key or corrupted format', async () => {
  const input = crypto.getRandomValues(new Uint8Array(1024))
  const box = await encryptVault(input, pass)
  assert.deepEqual(await decryptVault(box, pass), input)
  await assert.rejects(decryptVault(box, 'wrong passphrase'))
  await assert.rejects(decryptVault(box.replace('600000', '1'), pass))
  await assert.rejects(encryptVault('secret', 'short'))
})
test('malicious attachment URLs and malformed reply objects are rejected', async () => {
  for (const bad of [{ type: 'image', text: '', data: 'https://tracker.example/image' }, { type: 'file', text: '', data: 'data:text/html;base64,PHNjcmlwdD4=' }, { type: 'text', text: 'hi', reply: { name: {}, text: 'x' } }]) {
    const box = await encryptMessage(bad, header, alice.keys.privateKey, bob.publicKey)
    await assert.rejects(decryptMessage(box, bob.keys.privateKey, alice.publicKey))
  }
})
test('passwords and fingerprints use expected formats', async () => {
  const a = generatePassword(32, false), b = generatePassword(32, false)
  assert.equal(a.length, 32); assert.notEqual(a, b); assert.match(a, /^[A-Za-z0-9]+$/)
  assert.equal((await fingerprint(alice.publicKey)).split(' ').length, 16)
})
