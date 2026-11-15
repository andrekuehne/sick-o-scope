import { Hono } from "hono";
import { type Me, SignInRequest } from "../../shared/auth.ts";
import type { AppEnv } from "../app-env.ts";
import { listMembers } from "../members/members.ts";
import { clearSessionCookie, requireUser, sessionTokenFrom, setSessionCookie } from "./current-user.ts";
import { deviceLabel } from "./device-label.ts";
import { signOutDevice } from "./devices.ts";
import { redeemSignInLink } from "./sign-in-links.ts";

/** Sign-in, sign-out and "who am I" (ADR 0002). Mounted under /api. */
export const authRoutes = new Hono<AppEnv>();

authRoutes.post("/sign-in", async (c) => {
  // JSON only: a cross-site form can't send it (see the CSRF guard in index.ts).
  if (!c.req.header("content-type")?.startsWith("application/json")) return c.json({ error: "unknown" }, 415);
  const body = SignInRequest.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "unknown" }, 400);

  const redemption = await redeemSignInLink(c.env.DB, body.data.token, {
    deviceLabel: deviceLabel(c.req.header("user-agent")),
  });
  if (!redemption.ok) return c.json({ error: redemption.reason }, redemption.reason === "unknown" ? 400 : 410);

  const me = await meOf(c.env.DB, redemption.userId);
  if (!me) {
    // The User has no Family (any more): don't leave a signed-in Device behind.
    await signOutDevice(c.env.DB, redemption.deviceToken);
    return c.json({ error: "signed_out" }, 401);
  }

  // A Device this browser was signed in as before is replaced, not left behind.
  const previousToken = sessionTokenFrom(c);
  if (previousToken) await signOutDevice(c.env.DB, previousToken);

  setSessionCookie(c, redemption.deviceToken, redemption.deviceExpiresAt);
  return c.json(me);
});

authRoutes.post("/sign-out", async (c) => {
  const token = sessionTokenFrom(c);
  if (token) await signOutDevice(c.env.DB, token);
  clearSessionCookie(c);
  return c.body(null, 204);
});

authRoutes.get("/me", requireUser, async (c) => {
  const me = await meOf(c.env.DB, c.get("user").userId);
  return me ? c.json(me) : c.json({ error: "signed_out" }, 401);
});

/** The User, their Family and its Members. In v1 every User belongs to exactly one Family. */
async function meOf(db: D1Database, userId: string): Promise<Me | null> {
  const row = await db
    .prepare(
      `SELECT u.id AS user_id, u.display_name, f.id AS family_id, f.name AS family_name
       FROM users u
       JOIN family_users fu ON fu.user_id = u.id
       JOIN families f ON f.id = fu.family_id
       WHERE u.id = ?
       ORDER BY fu.created_at
       LIMIT 1`,
    )
    .bind(userId)
    .first<{ user_id: string; display_name: string; family_id: string; family_name: string }>();
  if (!row) return null;
  return {
    user: { id: row.user_id, name: row.display_name },
    family: { id: row.family_id, name: row.family_name },
    members: await listMembers(db, row.family_id),
  };
}
