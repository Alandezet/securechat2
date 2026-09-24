import express from 'express'
import compression from 'compression'
import { resolve } from 'node:path'
import { createApp } from './app.mjs'

const production = process.env.NODE_ENV === 'production'
const { app, close } = createApp({
  database: resolve(process.env.CIPHER_DATA_DIR || '.data', 'cipher.sqlite'),
  production,
  origin: process.env.APP_ORIGIN || '',
})
if (production) {
  // Only public static assets pass this point; never buffer the SSE API.
  app.use(compression({ threshold: 1024 }))
  app.use(express.static(resolve('dist'), { maxAge: '1h', etag: true }))
  app.get('/{*path}', (_req, res) => res.sendFile(resolve('dist/index.html')))
}
const port = Number(process.env.PORT || 3001)
const server = app.listen(port, '0.0.0.0', () => console.log(`Cipher relay listening on 0.0.0.0:${port} (${production ? 'production' : 'development'})`))
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { close(); server.close(() => process.exit(0)) })
