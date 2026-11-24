import { defineConfig, devices } from '@playwright/test';

const port = 4173;

/** End-to-end tests run against the real server serving the built interface, as it runs in the container. */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: `http://127.0.0.1:${port}`, trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    {
      name: 'tablet',
      use: { ...devices['Desktop Chrome'], viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: false },
    },
  ],
  webServer: {
    command: 'pnpm --filter @idontknot/web build && pnpm --filter @idontknot/server start',
    url: `http://127.0.0.1:${port}/healthz`,
    env: { PORT: String(port), IDK_VERSION: 'e2e' },
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000,
  },
});
