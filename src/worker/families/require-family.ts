import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../app-env.ts";

/**
 * The Family guard: lets a request through only when the signed-in User belongs to the
 * Family in the path (`:familyId`), and puts its id on the context as `familyId`.
 * Any other Family answers 404, exactly like one that doesn't exist, so ids can't be probed.
 * Runs after `requireUser`; every Family-scoped route goes through it (see families/routes.ts).
 */
export const requireFamily: MiddlewareHandler<AppEnv> = async (c, next) => {
  const familyId = c.req.param("familyId");
  const membership = familyId
    ? await c.env.DB.prepare("SELECT 1 FROM family_users WHERE family_id = ? AND user_id = ?")
        .bind(familyId, c.get("user").userId)
        .first()
    : null;
  if (!familyId || !membership) return c.json({ error: "not_found" }, 404);
  c.set("familyId", familyId);
  await next();
};
