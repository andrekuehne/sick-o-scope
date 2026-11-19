import { expect, it } from "vitest";
import { z } from "zod";
import { OFFLINE_DATA_SCHEMAS, OFFLINE_DATA_VERSION } from "../src/shared/offline-data.ts";

/**
 * The fingerprint of the kept data's shape, per version. When the schemas change, add the new
 * version with its fingerprint (the failure prints it); never change an entry that shipped.
 */
const SHAPES: Record<string, string> = {
  "2": "57f4bf83187c2f36",
};

async function fingerprint(): Promise<string> {
  const shapes = Object.entries(OFFLINE_DATA_SCHEMAS).map(([name, schema]) => [
    name,
    z.toJSONSchema(schema, { io: "output", unrepresentable: "any" }),
  ]);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(shapes)));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 16);
}

it("has a new version of the data kept for offline whenever its shape changes", async () => {
  expect(
    await fingerprint(),
    `The data kept for offline changed shape: bump OFFLINE_DATA_VERSION (src/shared/offline-data.ts) and add its fingerprint here, so phones throw away their old copy instead of crashing on it`,
  ).toBe(SHAPES[OFFLINE_DATA_VERSION]);
  // Each version stands for one shape.
  expect(new Set(Object.values(SHAPES)).size).toBe(Object.keys(SHAPES).length);
});
