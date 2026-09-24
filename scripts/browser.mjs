// Optional Chromium fallback for restricted CI/sandboxes where the Playwright CDN
// is unavailable. The production app never includes this development dependency.
import chromium from '@sparticuz/chromium'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { brotliDecompressSync } from 'node:zlib'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
export async function browserOptions() {
  if (!process.env.CIPHER_BUNDLED_BROWSER) return { headless: true }
  const dir = resolve('.tools/chromium-libs')
  if (!existsSync(`${dir}/lib/libnspr4.so`)) {
    mkdirSync(dir, { recursive: true })
    writeFileSync(`${dir}/al2023.tar`, brotliDecompressSync(readFileSync('node_modules/@sparticuz/chromium/bin/al2023.tar.br')))
    execFileSync('tar', ['xf', `${dir}/al2023.tar`, '-C', dir])
  }
  return { headless: true, executablePath: await chromium.executablePath(), args: chromium.args.filter(arg => !arg.includes('disable-web-security') && !arg.includes('single-process')), env: { ...process.env, LD_LIBRARY_PATH: `${dir}/lib${process.env.LD_LIBRARY_PATH ? ':' + process.env.LD_LIBRARY_PATH : ''}` } }
}
