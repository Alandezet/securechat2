import { defineConfig } from '@playwright/test'
import { browserOptions } from './scripts/browser.mjs'
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  use: { baseURL: 'http://localhost:5174', viewport: { width: 1440, height: 900 }, launchOptions: await browserOptions(), trace: 'retain-on-failure' },
  webServer: { command: 'CIPHER_DATA_DIR=.data/e2e CIPHER_WEB_PORT=5174 NODE_ENV=test node server/dev.mjs', url: 'http://localhost:5174', reuseExistingServer: false, timeout: 30000 },
})
