import { cpSync, mkdirSync, existsSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
if (!existsSync('dist/index.html')) throw new Error('Run npm run build before syncing Android assets.')
const target = resolve('app/src/main/assets/web')
rmSync(target, { recursive: true, force: true })
mkdirSync(target, { recursive: true })
cpSync(resolve('dist'), target, { recursive: true })
console.log('Bundled the production client for offline Android use.')
