let sodium
let loading
// Load the ~275 KB compressed cryptography module only when an account or vault needs it.
// The local demo and password generator don't download it.
async function loadSodium() {
  if (!loading) loading = import('libsodium-wrappers').then(async module => { sodium = module.default; await sodium.ready })
  return loading
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()
export const ready = () => loadSodium()
export const toBase64 = bytes => sodium.to_base64(bytes, sodium.base64_variants.ORIGINAL)
export const fromBase64 = value => sodium.from_base64(value, sodium.base64_variants.ORIGINAL)
const hex = bytes => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
const random = size => crypto.getRandomValues(new Uint8Array(size))

async function passwordKey(passphrase, salt, iterations = 600000) {
  const material = await crypto.subtle.importKey('raw', encoder.encode(passphrase), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

// The relay never receives the passphrase used to wrap the identity key.
// This domain-separated credential is still a bearer secret; TLS is required.
export async function deriveCredential(username, passphrase) {
  const material = await crypto.subtle.importKey('raw', encoder.encode(passphrase), 'PBKDF2', false, ['deriveBits'])
  const bytes = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: encoder.encode(`cipher-auth-v1:${username.toLowerCase()}`), iterations: 210000, hash: 'SHA-256' }, material, 256)
  return hex(new Uint8Array(bytes))
}

export async function createIdentity(username, passphrase) {
  await ready()
  const pair = sodium.crypto_box_keypair()
  const publicKey = toBase64(pair.publicKey)
  const salt = random(16), iv = random(12)
  const key = await passwordKey(passphrase, salt)
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: encoder.encode(`cipher-identity-v1:${username}:${publicKey}`) }, key, pair.privateKey)
  return {
    keys: { publicKey: pair.publicKey, privateKey: pair.privateKey }, publicKey,
    wrappedKey: { version: 1, salt: toBase64(salt), iv: toBase64(iv), ciphertext: toBase64(new Uint8Array(ciphertext)) },
  }
}

export async function unlockIdentity(username, passphrase, publicKey, wrapped) {
  await ready()
  if (wrapped.version !== 1) throw new Error('Unsupported identity format.')
  const key = await passwordKey(passphrase, fromBase64(wrapped.salt))
  const bytes = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(wrapped.iv), additionalData: encoder.encode(`cipher-identity-v1:${username}:${publicKey}`) }, key, fromBase64(wrapped.ciphertext))
  const privateKey = new Uint8Array(bytes)
  if (toBase64(sodium.crypto_scalarmult_base(privateKey)) !== publicKey) throw new Error('Identity verification failed.')
  return { publicKey: fromBase64(publicKey), privateKey }
}

export async function encryptMessage(body, header, privateKey, peerPublicKey) {
  await ready()
  const nonce = sodium.randombytes_buf(sodium.crypto_box_NONCEBYTES)
  const ciphertext = sodium.crypto_box_easy(JSON.stringify({ protocol: 'cipher-box-v1', header, body }), nonce, fromBase64(peerPublicKey), privateKey)
  return { ...header, nonce: toBase64(nonce), ciphertext: toBase64(ciphertext) }
}

export async function decryptMessage(envelope, privateKey, peerPublicKey) {
  await ready()
  const plain = sodium.crypto_box_open_easy(fromBase64(envelope.ciphertext), fromBase64(envelope.nonce), fromBase64(peerPublicKey), privateKey, 'text')
  const value = JSON.parse(plain)
  if (value.protocol !== 'cipher-box-v1' || ['id', 'sender', 'recipient', 'expiresAt'].some(key => (value.header[key] ?? null) !== (envelope[key] ?? null))) throw new Error('Message authentication failed.')
  if (!value.body || typeof value.body.text !== 'string' || value.body.text.length > 10000 || !['text', 'image', 'file', 'voice'].includes(value.body.type)) throw new Error('Invalid message content.')
  if (value.body.type === 'image' && !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value.body.data || '')) throw new Error('Unsupported image.')
  if (value.body.type === 'voice' && !/^data:audio\/(webm|ogg|mp4)(;codecs=[a-z0-9-]+)?;base64,[A-Za-z0-9+/=]+$/i.test(value.body.data || '')) throw new Error('Unsupported audio.')
  if (value.body.type === 'file' && !/^data:application\/octet-stream;base64,[A-Za-z0-9+/=]+$/.test(value.body.data || '')) throw new Error('Unsupported file.')
  const body = value.body
  if (body.name !== undefined && (typeof body.name !== 'string' || body.name.length > 255)) throw new Error('Invalid attachment name.')
  if (body.size !== undefined && (!Number.isSafeInteger(body.size) || body.size < 0 || body.size > 2097152)) throw new Error('Invalid attachment size.')
  if (body.reply !== undefined && (!body.reply || typeof body.reply.name !== 'string' || body.reply.name.length > 50 || typeof body.reply.text !== 'string' || body.reply.text.length > 10000)) throw new Error('Invalid quoted message.')
  return body
}

export async function fingerprint(publicKey) {
  await ready()
  const hash = await crypto.subtle.digest('SHA-256', fromBase64(publicKey))
  return hex(new Uint8Array(hash)).toUpperCase().match(/.{4}/g).join(' ')
}

export async function encryptVault(data, passphrase) {
  await ready()
  if (passphrase.length < 12) throw new Error('Use a passphrase of at least 12 characters.')
  const salt = random(16), iv = random(12)
  const key = await passwordKey(passphrase, salt)
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: encoder.encode('cipher-vault-v1') }, key, typeof data === 'string' ? encoder.encode(data) : data)
  return JSON.stringify({ format: 'cipher-vault-v1', kdf: 'PBKDF2-SHA256', iterations: 600000, salt: toBase64(salt), iv: toBase64(iv), ciphertext: toBase64(new Uint8Array(ciphertext)) })
}

export async function decryptVault(encoded, passphrase) {
  await ready()
  const box = JSON.parse(encoded)
  if (box.format !== 'cipher-vault-v1' || box.iterations !== 600000 || box.kdf !== 'PBKDF2-SHA256') throw new Error('Not a supported Cipher vault.')
  const key = await passwordKey(passphrase, fromBase64(box.salt))
  const bytes = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(box.iv), additionalData: encoder.encode('cipher-vault-v1') }, key, fromBase64(box.ciphertext))
  return new Uint8Array(bytes)
}

export function generatePassword(length = 24, symbols = true) {
  const alphabet = `ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789${symbols ? '!@#$%&*+-=?' : ''}`
  let result = ''
  // Rejection sampling avoids modulo bias.
  const ceiling = Math.floor(256 / alphabet.length) * alphabet.length
  while (result.length < length) for (const value of random(length)) if (value < ceiling && result.length < length) result += alphabet[value % alphabet.length]
  return result
}

export function destroyKeys(keys) {
  if (keys?.privateKey) sodium.memzero(keys.privateKey)
}

export const decodeText = bytes => decoder.decode(bytes)
