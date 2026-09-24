import { createServer as httpServer } from 'node:http'
import { createServer as viteServer } from 'vite'
import { resolve } from 'node:path'
import { createApp } from './app.mjs'

const port = Number(process.env.CIPHER_WEB_PORT || 5173)
const { app, close } = createApp({ disableLimits: process.env.NODE_ENV === 'test', database: resolve(process.env.CIPHER_DATA_DIR || '.data', 'cipher.sqlite') })
const server = httpServer(app)
const vite = await viteServer({ server: { port, middlewareMode: true, hmr: { server }, proxy: undefined }, appType: 'spa' })
app.use(vite.middlewares)
server.listen(port, '0.0.0.0', () => console.log(`Cipher messenger and encrypted relay ready on http://0.0.0.0:${port}`))
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { close(); await vite.close(); server.close(() => process.exit(0)) })
