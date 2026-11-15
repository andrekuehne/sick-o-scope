// Wipes a local state directory and applies all migrations to a fresh local D1 in it.
// Used by the end-to-end tests:  node scripts/reset-local-db.ts .wrangler/e2e-state

import { execSync } from "node:child_process";
import { rm } from "node:fs/promises";

const dir = process.argv[2];
if (!dir || !/^[\w./-]+$/.test(dir)) {
  console.error("Usage: node scripts/reset-local-db.ts <state dir>");
  process.exit(1);
}

await rm(dir, { recursive: true, force: true });
// Through a shell, so `npx` resolves on Windows too; `dir` is checked above.
execSync(`npx wrangler d1 migrations apply DB --local --persist-to ${dir} --config wrangler.jsonc`, {
  stdio: "inherit",
});
