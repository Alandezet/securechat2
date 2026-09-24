import express from 'express'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import { rateLimit } from 'express-rate-limit'
import { DatabaseSync } from 'node:sqlite'
import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto'
import { promisify } from 'node:util'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const scrypt = promisify(scryptCallback)
const hash = value => createHash('sha256').update(value).digest('hex')
const DAY = 86400000
const COOKIE = 'cipher_session'
const publicUser = row => row && ({ id: row.id, name: row.name, username: row.username, publicKey: row.public_key })
const isB64 = (v, bytes) => typeof v === 'string' && /^[A-Za-z0-9+/]+={0,2}$/.test(v) && Buffer.from(v, 'base64').length === bytes
const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

export function createApp({ database = '.data/cipher.sqlite', production = false, origin = '', disableLimits = false } = {}) {
  if (database !== ':memory:') mkdirSync(dirname(resolve(database)), { recursive: true, mode: 0o700 })
  const db = new DatabaseSync(database)
  db.exec(`PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
      salt TEXT NOT NULL, verifier TEXT NOT NULL, public_key TEXT NOT NULL,
      wrapped_key TEXT NOT NULL, created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY, sender TEXT NOT NULL REFERENCES users(id), recipient TEXT NOT NULL REFERENCES users(id),
      nonce TEXT NOT NULL, ciphertext TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS messages_recipient ON messages(recipient, created_at);
    CREATE INDEX IF NOT EXISTS messages_sender ON messages(sender, created_at);
    CREATE TABLE IF NOT EXISTS blocks (owner TEXT NOT NULL REFERENCES users(id), peer TEXT NOT NULL REFERENCES users(id), PRIMARY KEY(owner, peer));
  `)
  const streams = new Map()
  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', 1)
  app.use(helmet({
    contentSecurityPolicy: production ? {
      directives: {
        defaultSrc: ["'self'"], scriptSrc: ["'self'", "'wasm-unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'"], imgSrc: ["'self'", 'data:', 'blob:'],
        mediaSrc: ["'self'", 'blob:', 'data:'], fontSrc: ["'self'"],
        connectSrc: ["'self'"], objectSrc: ["'none'"], frameAncestors: null,
        upgradeInsecureRequests: null,
      },
    } : false,
    frameguard: false,
    crossOriginEmbedderPolicy: false,
    strictTransportSecurity: production,
  }))
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store')
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      if (req.get('X-Cipher-Client') !== '1') return res.status(403).json({ error: 'Missing request verification.' })
      const requestOrigin = req.get('Origin')
      if (requestOrigin) {
        try {
          const expected = origin ? new URL(origin).host : req.get('host')
          if (new URL(requestOrigin).host !== expected || req.get('Sec-Fetch-Site') === 'cross-site') {
            return res.status(403).json({ error: 'Cross-origin requests are not allowed.' })
          }
        } catch { return res.status(403).json({ error: 'Invalid origin.' }) }
      }
    }
    next()
  })
  app.use(express.json({ limit: '3mb', strict: true }))
  app.use(cookieParser())
  if (!disableLimits) {
    app.use('/api', rateLimit({ windowMs: 60000, limit: 240, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Too many requests. Please wait a minute.' } }))
    app.use('/api/auth/login', rateLimit({ windowMs: 900000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Too many login attempts. Try again in 15 minutes.' } }))
    app.use('/api/auth/register', rateLimit({ windowMs: 3600000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Account creation limit reached. Please try later.' } }))
  }
  const cookieOptions = { httpOnly: true, secure: production, sameSite: 'strict', path: '/', maxAge: DAY }
  const setSession = (res, id) => {
    const token = randomBytes(32).toString('hex')
    db.prepare('INSERT INTO sessions VALUES (?, ?, ?)').run(hash(token), id, Date.now() + DAY)
    res.cookie(COOKIE, token, cookieOptions)
  }
  const authenticated = (req, res, next) => {
    const token = req.cookies[COOKIE]
    if (typeof token !== 'string' || token.length !== 64) return res.status(401).json({ error: 'Please log in to continue.' })
    req.sessionHash = hash(token)
    const session = db.prepare('SELECT * FROM sessions WHERE token_hash = ? AND expires_at > ?').get(req.sessionHash, Date.now())
    if (!session) return res.status(401).json({ error: 'Your session expired. Please log in again.' })
    req.user = db.prepare('SELECT * FROM users WHERE id = ?').get(session.user_id)
    req.sessionExpires = session.expires_at
    next()
  }
  const emit = (id, event, value) => {
    for (const entry of streams.get(id) || []) entry.res.write(`event: ${event}\ndata: ${JSON.stringify(value)}\n\n`)
  }
  const closeSessions = (userId, sessionHash) => {
    for (const entry of streams.get(userId) || []) if (!sessionHash || entry.hash === sessionHash) { entry.res.write('event: session-ended\ndata: {}\n\n'); entry.res.end() }
  }
  app.get('/api/health', (_req, res) => res.json({ status: 'ok', protocol: 'cipher-box-v1', audited: false }))
  app.post('/api/auth/register', asyncRoute(async (req, res) => {
    const { name, username, credential, publicKey, wrappedKey } = req.body
    if (typeof username !== 'string' || !/^[a-z0-9_]{3,24}$/.test(username) || typeof name !== 'string' || !name.trim() || name.trim().length > 50) {
      return res.status(400).json({ error: 'Use a name and a username of 3–24 lowercase letters, numbers, or underscores.' })
    }
    if (typeof credential !== 'string' || !/^[a-f0-9]{64}$/.test(credential) || !isB64(publicKey, 32) || wrappedKey?.version !== 1 || !isB64(wrappedKey.salt, 16) || !isB64(wrappedKey.iv, 12) || !isB64(wrappedKey.ciphertext, 48)) {
      return res.status(400).json({ error: 'Invalid cryptographic account data.' })
    }
    if (db.prepare('SELECT id FROM users WHERE username = ?').get(username)) return res.status(409).json({ error: 'That username is already taken.' })
    const salt = randomBytes(32).toString('hex')
    const verifier = (await scrypt(credential, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 })).toString('hex')
    const id = randomUUID()
    try {
      db.prepare('INSERT INTO users VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(id, username, name.trim(), salt, verifier, publicKey, JSON.stringify(wrappedKey), Date.now())
    } catch (error) {
      if (String(error).includes('UNIQUE')) return res.status(409).json({ error: 'That username is already taken.' })
      throw error
    }
    setSession(res, id)
    res.status(201).json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id)) })
  }))
  app.post('/api/auth/login', asyncRoute(async (req, res) => {
    const { username, credential } = req.body
    if (typeof username !== 'string' || typeof credential !== 'string' || !/^[a-f0-9]{64}$/.test(credential)) return res.status(400).json({ error: 'Invalid login details.' })
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username.toLowerCase())
    // Perform the same expensive KDF for nonexistent accounts to reduce timing disclosure.
    const check = await scrypt(credential, user?.salt || '0'.repeat(64), 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 })
    if (!user || !timingSafeEqual(check, Buffer.from(user.verifier, 'hex'))) return res.status(401).json({ error: 'Incorrect username or passphrase.' })
    setSession(res, user.id)
    res.json({ user: publicUser(user), wrappedKey: JSON.parse(user.wrapped_key) })
  }))
  app.get('/api/auth/me', authenticated, (req, res) => res.json({ user: publicUser(req.user) }))
  app.post('/api/auth/logout', authenticated, (req, res) => {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(req.sessionHash)
    closeSessions(req.user.id, req.sessionHash)
    res.clearCookie(COOKIE, cookieOptions).json({ ok: true })
  })
  app.post('/api/auth/logout-all', authenticated, (req, res) => {
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(req.user.id)
    closeSessions(req.user.id)
    res.clearCookie(COOKIE, cookieOptions).json({ ok: true })
  })
  app.get('/api/users', authenticated, (req, res) => {
    const query = String(req.query.q || '').replace(/^@/, '').toLowerCase()
    if (!/^[a-z0-9_]{2,24}$/.test(query)) return res.json({ users: [] })
    const users = db.prepare('SELECT * FROM users WHERE username LIKE ? ESCAPE \'\\\' AND id != ? LIMIT 20').all(`${query.replaceAll('_', '\\_')}%`, req.user.id)
    res.json({ users: users.map(publicUser) })
  })
  const envelope = row => ({ id: row.id, sender: row.sender, recipient: row.recipient, nonce: row.nonce, ciphertext: row.ciphertext, createdAt: row.created_at, expiresAt: row.expires_at })
  app.get('/api/messages', authenticated, (req, res) => {
    const after = Number(req.query.after || 0)
    if (!Number.isSafeInteger(after) || after < 0) return res.status(400).json({ error: 'Invalid message cursor.' })
    const rows = db.prepare(`SELECT * FROM (SELECT * FROM messages WHERE (sender = ? OR recipient = ?) AND created_at > ? AND (expires_at IS NULL OR expires_at > ?) ORDER BY created_at DESC LIMIT 500) ORDER BY created_at ASC`).all(req.user.id, req.user.id, after, Date.now())
    const ids = [...new Set(rows.flatMap(row => [row.sender, row.recipient]).filter(id => id !== req.user.id))]
    res.json({ messages: rows.map(envelope), peers: ids.map(id => publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id))) })
  })
  app.post('/api/messages', authenticated, (req, res) => {
    const { id, recipient, nonce, ciphertext, expiresAt } = req.body
    const now = Date.now()
    if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/.test(id) || !isB64(nonce, 24) || typeof ciphertext !== 'string' || ciphertext.length < 24 || ciphertext.length > 2800000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(ciphertext) || !db.prepare('SELECT id FROM users WHERE id = ?').get(String(recipient))) {
      return res.status(400).json({ error: 'Invalid encrypted message or recipient.' })
    }
    if (expiresAt != null && (!Number.isSafeInteger(expiresAt) || expiresAt < now + 10000 || expiresAt > now + 7 * DAY + 60000)) return res.status(400).json({ error: 'Invalid message expiration.' })
    if (db.prepare('SELECT 1 FROM blocks WHERE (owner = ? AND peer = ?) OR (owner = ? AND peer = ?)').get(recipient, req.user.id, req.user.id, recipient)) return res.status(403).json({ error: 'This conversation is unavailable.' })
    if (db.prepare('SELECT id FROM messages WHERE id = ?').get(id)) return res.status(409).json({ error: 'This message has already been sent.' })
    db.prepare('INSERT INTO messages VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, req.user.id, recipient, nonce, ciphertext, now, expiresAt || null)
    const message = envelope(db.prepare('SELECT * FROM messages WHERE id = ?').get(id))
    emit(recipient, 'message', { message, peer: publicUser(req.user) })
    emit(req.user.id, 'message', { message, peer: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(recipient)) })
    res.status(201).json({ message })
  })
  app.delete('/api/messages/:id', authenticated, (req, res) => {
    const row = db.prepare('SELECT * FROM messages WHERE id = ? AND sender = ?').get(req.params.id, req.user.id)
    if (!row) return res.status(404).json({ error: 'Message not found or not yours.' })
    db.prepare('DELETE FROM messages WHERE id = ?').run(row.id)
    emit(row.recipient, 'deleted', { id: row.id })
    emit(row.sender, 'deleted', { id: row.id })
    res.json({ ok: true })
  })
  app.get('/api/blocks', authenticated, (req, res) => res.json({ ids: db.prepare('SELECT peer FROM blocks WHERE owner = ?').all(req.user.id).map(row => row.peer) }))
  app.post('/api/blocks/:id', authenticated, (req, res) => {
    if (!db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id)) return res.status(404).json({ error: 'Contact not found.' })
    db.prepare('INSERT OR IGNORE INTO blocks VALUES (?, ?)').run(req.user.id, req.params.id)
    res.json({ ok: true })
  })
  app.delete('/api/blocks/:id', authenticated, (req, res) => {
    db.prepare('DELETE FROM blocks WHERE owner = ? AND peer = ?').run(req.user.id, req.params.id)
    res.json({ ok: true })
  })
  app.get('/api/events', authenticated, (req, res) => {
    const existing = streams.get(req.user.id) || new Set()
    if (existing.size >= 5) return res.status(429).json({ error: 'Too many open sessions.' })
    res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' })
    res.flushHeaders()
    const entry = { res, hash: req.sessionHash }
    existing.add(entry)
    streams.set(req.user.id, existing)
    res.write('event: connected\ndata: {}\n\n')
    const heartbeat = setInterval(() => {
      if (Date.now() >= req.sessionExpires) { res.write('event: session-ended\ndata: {}\n\n'); return res.end() }
      res.write(': heartbeat\n\n')
    }, 25000)
    req.on('close', () => {
      clearInterval(heartbeat)
      existing.delete(entry)
      if (!existing.size) streams.delete(req.user.id)
    })
  })
  const cleanup = setInterval(() => {
    db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now())
    db.prepare('DELETE FROM messages WHERE expires_at IS NOT NULL AND expires_at <= ?').run(Date.now())
  }, 30000)
  cleanup.unref()
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Endpoint not found.' }))
  app.use((error, _req, res, _next) => {
    if (error.type === 'entity.too.large') return res.status(413).json({ error: 'Attachment too large. Enable low-data mode or choose a smaller file.' })
    if (error instanceof SyntaxError) return res.status(400).json({ error: 'Invalid request.' })
    console.error('Relay request failed:', error.code || error.name)
    res.status(500).json({ error: 'Something went wrong. Please try again.' })
  })
  let closed = false
  const close = () => {
    if (closed) return
    closed = true
    clearInterval(cleanup)
    for (const entries of streams.values()) for (const entry of entries) entry.res.end()
    db.close()
  }
  return { app, db, close }
}
