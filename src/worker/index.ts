import { Hono } from "hono";
import { csrf } from "hono/csrf";
import { HTTPException } from "hono/http-exception";
import type { ServiceStatus } from "../shared/service-status.ts";
import type { AppEnv } from "./app-env.ts";
import { authRoutes } from "./auth/routes.ts";
import { familyRoutes } from "./families/routes.ts";

// The Worker only ever sees /api/* (wrangler.jsonc: run_worker_first);
// everything else is the SPA, served as static assets (ADR 0001).
const app = new Hono<AppEnv>().basePath("/api");

// Other sites can't make a signed-in browser change anything here, nor sign it into
// another Family: cross-site form posts are refused. The API itself only takes JSON,
// which a cross-site form can't send.
app.use(csrf());

app.route("/", authRoutes);
app.route("/families/:familyId", familyRoutes);

app.get("/status", async (c) => {
  await c.env.DB.prepare("SELECT 1").first();
  return c.json({ status: "ok", database: "ok" } satisfies ServiceStatus);
});

// Refusals stay JSON too (the CSRF guard answers with an HTTPException).
app.onError((error, c) => {
  if (error instanceof HTTPException && error.status === 403) return c.json({ error: "forbidden" }, 403);
  throw error;
});

// Unknown API paths stay JSON, so the client never mistakes an error for a page.
app.notFound((c) => c.json({ error: "not_found" }, 404));

export default {
  fetch: app.fetch,
} satisfies ExportedHandler<Env>;
