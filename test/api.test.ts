import { exports } from "cloudflare:workers";
import { expect, it } from "vitest";
import { ServiceStatus } from "../src/shared/service-status.ts";

it("reports the service status as JSON, including the database", async () => {
  const res = await exports.default.fetch("http://example.com/api/status");
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toContain("application/json");
  const body = await res.json();
  expect(ServiceStatus.safeParse(body).success).toBe(true);
  expect(body).toEqual({ status: "ok", database: "ok" });
});

it("answers unknown API paths with a JSON 404, never the app's HTML", async () => {
  const res = await exports.default.fetch("http://example.com/api/does-not-exist");
  expect(res.status).toBe(404);
  expect(res.headers.get("content-type")).toContain("application/json");
  expect(await res.json()).toEqual({ error: "not_found" });
});
