// End-to-end tests in a real browser (`npm run test:e2e`), against the production
// build served by `vite preview`: the built SPA as static assets plus the Worker
// in the local Workers runtime, exactly as deployed.
// Android Chrome is the primary target, so only Chromium runs (phone-sized, with touch).

import { defineConfig, devices } from "@playwright/test";

const PORT = 8793;

const phone = (width: number) => ({
  ...devices["Pixel 7"],
  viewport: { width, height: 740 },
});

export default defineConfig({
  testDir: "e2e",
  testMatch: "**/*.e2e.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // No retries: a test that fails once in CI blocks the deploy.
  retries: 0,
  reporter: process.env.CI ? [["list"], ["github"]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium-390", use: phone(390) },
    { name: "chromium-320", use: phone(320) },
  ],
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/`,
    // Always a fresh build and server, never one left running.
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
