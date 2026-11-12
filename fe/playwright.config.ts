import { defineConfig } from '@playwright/test';

// Browser tests mock both WebSockets and the basemap, so they need neither the backend nor internet.
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  workers: 1,
  use: { baseURL: 'http://localhost:5174', screenshot: 'only-on-failure' },
  webServer: {
    // Pin the flags so the tests do not depend on a local .env.
    command: 'npx vite --port 5174 --strictPort',
    env: { VITE_AUTO_RECONNECT: 'false', VITE_OBSERVED_TRAILS: 'false', VITE_WS_BASE_URL: 'ws://localhost:4000' },
    url: 'http://localhost:5174',
    reuseExistingServer: false,
  },
});
