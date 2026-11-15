import { Hono } from "hono";
import { utcToday } from "../../shared/dates.ts";
import type { AppEnv } from "../app-env.ts";
import { allCheckInsWithMemberNames } from "../check-ins/check-ins.ts";
import { checkInsCsv } from "./csv.ts";

/** Downloads of a Family's data. Mounted inside the Family guard (families/routes.ts). */
export const exportRoutes = new Hono<AppEnv>();

exportRoutes.get("/export.csv", async (c) => {
  const checkIns = await allCheckInsWithMemberNames(c.env.DB, c.get("familyId"));
  return c.body(checkInsCsv(checkIns), 200, {
    "content-type": "text/csv; charset=utf-8",
    "content-disposition": `attachment; filename="sick-o-scope-${utcToday()}.csv"`,
    "cache-control": "no-store",
  });
});
