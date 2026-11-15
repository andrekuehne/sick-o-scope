// Small helpers shared by the API's route modules.

import type { Context } from "hono";
import type { z } from "zod";
import { addDays, utcToday } from "../shared/dates.ts";
import type { AppEnv } from "./app-env.ts";

/** The JSON body checked against a shared schema, or the 400 answer to send instead. */
export async function parseBody<T>(
  c: Context<AppEnv>,
  schema: z.ZodType<T>,
): Promise<{ ok: true; data: T } | { ok: false; response: Response }> {
  const parsed = schema.safeParse(await c.req.json().catch(() => null));
  return parsed.success
    ? { ok: true, data: parsed.data }
    : { ok: false, response: c.json({ error: "invalid", issues: parsed.error.issues }, 400) };
}

export function notFound(c: Context<AppEnv>) {
  return c.json({ error: "not_found" }, 404);
}

export function invalidDate(c: Context<AppEnv>) {
  return c.json({ error: "invalid", message: "a real date like 2026-11-15" }, 400);
}

export function futureDate(c: Context<AppEnv>) {
  return c.json({ error: "future_date" }, 400);
}

/**
 * True for dates nobody can have lived yet. The server's UTC date can be a day behind
 * the Family's local date, so one day ahead is still allowed; the app blocks the rest.
 */
export function isFutureDate(date: string, now = new Date()): boolean {
  return date > addDays(utcToday(now), 1);
}
