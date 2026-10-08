import { defineConfig } from '@playwright/test';
const baseURL = process.env['E2E_BASE_URL'] ?? 'http://127.0.0.1:14200';
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  expect: { timeout: 10000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL, trace: 'off', screenshot: 'off', video: 'off' },
  webServer: process.env['E2E_BASE_URL']
    ? undefined
    : {
        command:
          'npm run start -- --host 127.0.0.1 --port 14200 --proxy-config proxy.e2e.conf.json',
        url: baseURL,
        reuseExistingServer: !process.env['CI'],
        timeout: 120000,
      },
});
