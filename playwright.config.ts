import { defineConfig } from '@playwright/test';

// Smoke test against the production build (vite preview), on a desktop and
// on a phone held sideways. Served from localhost, so the game's debug hooks
// (?level=, window.__game — see src/util/env.ts) are available to the tests.
//
// @playwright/test is pinned: each version drives one specific browser
// build, and an unpinned bump means an `npx playwright install` download
// before the next run.

// Headless Chromium picks a software renderer by default; on macOS, Metal
// gives it the real GPU, so frame timing means something.
const gpuArgs = process.platform === 'darwin' ? ['--use-angle=metal', '--ignore-gpu-blocklist'] : ['--ignore-gpu-blocklist'];

export default defineConfig({
  testDir: 'tests',
  timeout: 90_000,
  // One GPU: parallel WebGL pages starve each other and turn timing into noise.
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173',
    browserName: 'chromium',
    launchOptions: { args: gpuArgs },
  },
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 720 } } },
    { name: 'phone', use: { viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true } },
  ],
});
