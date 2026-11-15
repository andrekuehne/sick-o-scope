import { type Context, Hono } from "hono";
import type { z } from "zod";
import { type Member, MemberInput, MemberOrder } from "../../shared/members.ts";
import type { AppEnv } from "../app-env.ts";
import { addMember, listMembers, reorderMembers, setArchived, updateMember } from "./members.ts";

/** Managing a Family's Members. Mounted inside the Family guard (families/routes.ts). */
export const memberRoutes = new Hono<AppEnv>();

memberRoutes.get("/", async (c) => c.json({ members: await listMembers(c.env.DB, c.get("familyId")) }));

memberRoutes.post("/", async (c) => {
  const input = await parseBody(c, MemberInput);
  if (!input.ok) return input.response;
  return c.json(await addMember(c.env.DB, c.get("familyId"), input.data), 201);
});

// Registered before "/:memberId" so "order" isn't taken for a Member id.
memberRoutes.put("/order", async (c) => {
  const order = await parseBody(c, MemberOrder);
  if (!order.ok) return order.response;
  const outcome = await reorderMembers(c.env.DB, c.get("familyId"), order.data.memberIds);
  if (outcome === "not_found") return c.json({ error: "not_found" }, 404);
  if (outcome === "incomplete") return c.json({ error: "invalid", message: "name every active Member exactly once" }, 400);
  return c.json({ members: await listMembers(c.env.DB, c.get("familyId")) });
});

memberRoutes.put("/:memberId", async (c) => {
  const input = await parseBody(c, MemberInput);
  if (!input.ok) return input.response;
  return memberOrNotFound(c, await updateMember(c.env.DB, c.get("familyId"), c.req.param("memberId"), input.data));
});

memberRoutes.post("/:memberId/archive", async (c) =>
  memberOrNotFound(c, await setArchived(c.env.DB, c.get("familyId"), c.req.param("memberId"), true)),
);

memberRoutes.post("/:memberId/unarchive", async (c) =>
  memberOrNotFound(c, await setArchived(c.env.DB, c.get("familyId"), c.req.param("memberId"), false)),
);

/** The JSON body checked against a shared schema, or the 400 answer to send instead. */
async function parseBody<T>(
  c: Context<AppEnv>,
  schema: z.ZodType<T>,
): Promise<{ ok: true; data: T } | { ok: false; response: Response }> {
  const parsed = schema.safeParse(await c.req.json().catch(() => null));
  return parsed.success
    ? { ok: true, data: parsed.data }
    : { ok: false, response: c.json({ error: "invalid", issues: parsed.error.issues }, 400) };
}

function memberOrNotFound(c: Context<AppEnv>, member: Member | null) {
  return member ? c.json(member) : c.json({ error: "not_found" }, 404);
}
