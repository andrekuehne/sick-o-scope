import { env, exports } from "cloudflare:workers";
import { expect, it } from "vitest";

it("serves the start page", async () => {
  const res = await exports.default.fetch("http://example.com/");
  expect(res.status).toBe(200);
  expect(await res.text()).toContain("sick-o-scope");
});

it("has a migrated D1 database", async () => {
  const row = await env.DB.prepare("SELECT 1 AS one").first<{ one: number }>();
  expect(row?.one).toBe(1);
});
