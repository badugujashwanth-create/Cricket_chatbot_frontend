import { defineConfig } from '@playwright/test';

const useManagedServer = process.env.PLAYWRIGHT_MANAGED_SERVER !== 'false';

export default defineConfig({
  testDir: './scripts',
  fullyParallel: false,
  workers: 1,
  reporter: 'line',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    browserName: 'chromium',
    viewport: { width: 1280, height: 720 },
    reducedMotion: 'reduce',
    trace: 'retain-on-failure'
  },
  webServer: useManagedServer
    ? {
        command: 'npm run dev -- --host 127.0.0.1 --port 4173',
        url: 'http://127.0.0.1:4173',
        reuseExistingServer: !process.env.CI,
        timeout: 60_000
      }
    : undefined
});
