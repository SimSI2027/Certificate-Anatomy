import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 45000,
  fullyParallel: false,
  workers: 2,
  reporter: [['list']],
  use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, baseURL: 'http://127.0.0.1:5173' },
  webServer: [
    { command: 'npx vite', url: 'http://127.0.0.1:5173', reuseExistingServer: true, timeout: 60000 },
    {
      command: 'npx vite build && npx vite preview --port 4173 --strictPort',
      url: 'http://127.0.0.1:4173/Certificate-Anatomy/',
      reuseExistingServer: true,
      timeout: 120000,
    },
  ],
});
