import { type Context, Hono } from "hono";
import { type Member, MemberInput, MemberOrder } from "../../shared/members.ts";
import type { AppEnv } from "../app-env.ts";
import { notFound, parseBody } from "../http.ts";
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
  if (outcome === "not_found") return notFound(c);
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

function memberOrNotFound(c: Context<AppEnv>, member: Member | null) {
  return member ? c.json(member) : notFound(c);
}
