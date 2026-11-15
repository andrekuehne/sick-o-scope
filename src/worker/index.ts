import { Hono } from "hono";
import type { ServiceStatus } from "../shared/service-status";

// The Worker only ever sees /api/* (wrangler.jsonc: run_worker_first);
// everything else is the SPA, served as static assets (ADR 0001).
const app = new Hono<{ Bindings: Env }>().basePath("/api");

app.get("/status", async (c) => {
  await c.env.DB.prepare("SELECT 1").first();
  return c.json({ status: "ok", database: "ok" } satisfies ServiceStatus);
});

// Unknown API paths stay JSON, so the client never mistakes an error for a page.
app.notFound((c) => c.json({ error: "not_found" }, 404));

export default {
  fetch: app.fetch,
} satisfies ExportedHandler<Env>;
