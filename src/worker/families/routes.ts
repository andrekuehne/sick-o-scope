import { Hono } from "hono";
import type { AppEnv } from "../app-env.ts";
import { requireUser } from "../auth/current-user.ts";
import { checkInRoutes } from "../check-ins/routes.ts";
import { exportRoutes } from "../export/routes.ts";
import { memberRoutes } from "../members/routes.ts";
import { reminderRoutes } from "../reminders/routes.ts";
import { userRoutes } from "../users/routes.ts";
import { requireFamily } from "./require-family.ts";

/**
 * Everything under /api/families/:familyId. Every route mounted here passes the
 * Family guard first, so a Family's data is only ever reachable by its own Users.
 * New Family-scoped routes belong here, never elsewhere.
 */
export const familyRoutes = new Hono<AppEnv>();

familyRoutes.use("*", requireUser, requireFamily);
familyRoutes.route("/members", memberRoutes);
familyRoutes.route("/check-ins", checkInRoutes);
familyRoutes.route("/", userRoutes);
familyRoutes.route("/", exportRoutes);
familyRoutes.route("/", reminderRoutes);
