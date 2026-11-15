// End-to-end tests in a real browser (`npm run test:e2e`), against the production
// build served by `vite preview`: the built SPA as static assets plus the Worker
// in the local Workers runtime, exactly as deployed. They use their own local D1,
// wiped and migrated before every run, and create Sign-in links with the setup command.
// Android Chrome is the primary target, so only Chromium runs (phone-sized, with touch).

import { defineConfig, devices } from "@playwright/test";
import { E2E_BASE_URL, E2E_PORT, E2E_STATE_DIR } from "./e2e/env.ts";

const phone = (width: number) => ({
  ...devices["Pixel 7"],
  viewport: { width, height: 740 },
});

export default defineConfig({
  testDir: "e2e",
  testMatch: "**/*.e2e.ts",
  // One test at a time: the setup command writes to the same local SQLite file as the
  // running app, and two processes writing it at once fail with SQLITE_BUSY.
  workers: 1,
  forbidOnly: !!process.env.CI,
  // No retries: a test that fails once in CI blocks the deploy.
  retries: 0,
  reporter: process.env.CI ? [["list"], ["github"]] : "list",
  use: {
    baseURL: E2E_BASE_URL,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium-390", use: phone(390) },
    { name: "chromium-320", use: phone(320) },
  ],
  webServer: {
    command: [
      `node scripts/reset-local-db.ts ${E2E_STATE_DIR}`,
      "npm run build",
      `npx vite preview --port ${E2E_PORT} --strictPort`,
    ].join(" && "),
    env: { SOS_STATE_DIR: E2E_STATE_DIR },
    url: `${E2E_BASE_URL}/api/status`,
    // Always a fresh build, database and server, never one left running.
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
