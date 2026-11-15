import { Hono } from "hono";
import { SignInLinkRequest } from "../../shared/users.ts";
import type { AppEnv } from "../app-env.ts";
import { signOutFamilyDevice } from "../auth/devices.ts";
import { createSignInLink, signInLinkUrl } from "../auth/sign-in-links.ts";
import { notFound, parseBody } from "../http.ts";
import { familyUsersWithDevices, removeUser } from "./users.ts";

/**
 * A Family's Users and their Devices, and Gerät hinzufügen. Any User of the Family may
 * manage all of them. Mounted inside the Family guard (families/routes.ts).
 */
export const userRoutes = new Hono<AppEnv>();

userRoutes.post("/sign-in-links", async (c) => {
  const body = await parseBody(c, SignInLinkRequest);
  if (!body.ok) return body.response;
  const link = await createSignInLink(c.env.DB, {
    familyId: c.get("familyId"),
    createdBy: c.get("user").userId,
    ...body.data,
  });
  if (!link) return notFound(c);
  // The link points back at whichever address the app is used under.
  const url = signInLinkUrl(new URL(c.req.url).origin, link.token);
  return c.json({ url, expiresAt: link.expiresAt.toISOString() }, 201);
});

userRoutes.get("/users", async (c) => c.json(await familyUsersWithDevices(c.env.DB, c.get("familyId"), c.get("user"))));

userRoutes.delete("/devices/:deviceId", async (c) => {
  const signedOut = await signOutFamilyDevice(c.env.DB, c.get("familyId"), c.req.param("deviceId"));
  return signedOut ? c.body(null, 204) : notFound(c);
});

userRoutes.delete("/users/:userId", async (c) => {
  const result = await removeUser(c.env.DB, c.get("familyId"), c.req.param("userId"));
  if (result === "not_found") return notFound(c);
  if (result === "last_user") return c.json({ error: "last_user" }, 409);
  return c.body(null, 204);
});
