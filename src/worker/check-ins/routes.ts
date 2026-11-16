import { type Context, Hono } from "hono";
import { CheckInState, FillGapsRequest } from "../../shared/check-ins.ts";
import { daysBetweenInclusive, isCalendarDate } from "../../shared/dates.ts";
import type { AppEnv } from "../app-env.ts";
import { futureDate, invalidDate, isFutureDate, notFound, parseBody } from "../http.ts";
import { allCheckIns, checkInsBetween, deleteCheckIn, fillGaps, membersOfFamily, saveCheckIn } from "./check-ins.ts";

/** A Season and a bit: enough for any view, small enough to stay cheap. */
const MAX_RANGE_DAYS = 400;

/** Reading and writing a Family's Check-ins. Mounted inside the Family guard (families/routes.ts). */
export const checkInRoutes = new Hono<AppEnv>();

checkInRoutes.get("/", async (c) => {
  const from = c.req.query("from") ?? "";
  const to = c.req.query("to") ?? "";
  const days = isCalendarDate(from) && isCalendarDate(to) ? daysBetweenInclusive(from, to) : 0;
  if (days < 1 || days > MAX_RANGE_DAYS) {
    return c.json({ error: "invalid", message: `from and to: real dates, up to ${MAX_RANGE_DAYS} days apart` }, 400);
  }
  return c.json({ checkIns: await checkInsBetween(c.env.DB, c.get("familyId"), from, to) });
});

checkInRoutes.get("/all", async (c) => c.json({ checkIns: await allCheckIns(c.env.DB, c.get("familyId")) }));

checkInRoutes.post("/fill-gaps", async (c) => {
  const body = await parseBody(c, FillGapsRequest);
  if (!body.ok) return body.response;
  const requested = body.data.checkIns;
  if (requested.some((w) => isFutureDate(w.date))) return futureDate(c);

  const familyId = c.get("familyId");
  const known = await membersOfFamily(c.env.DB, familyId, requested.map((w) => w.memberId));
  if (!requested.every((w) => known.has(w.memberId))) return notFound(c);

  const writes = requested.map(({ memberId, date, ...state }) => ({ memberId, date, state }));
  return c.json(await fillGaps(c.env.DB, writes, { familyId, userId: c.get("user").userId, now: new Date() }));
});

checkInRoutes.put("/:date/:memberId", async (c) => {
  const day = await memberDay(c);
  if (!day.ok) return day.response;
  if (isFutureDate(day.date)) return futureDate(c);
  const state = await parseBody(c, CheckInState);
  if (!state.ok) return state.response;
  return c.json(
    await saveCheckIn(c.env.DB, {
      familyId: c.get("familyId"),
      memberId: day.memberId,
      date: day.date,
      state: state.data,
      userId: c.get("user").userId,
      now: new Date(),
    }),
  );
});

checkInRoutes.delete("/:date/:memberId", async (c) => {
  const day = await memberDay(c);
  if (!day.ok) return day.response;
  await deleteCheckIn(c.env.DB, c.get("familyId"), day.memberId, day.date);
  return c.body(null, 204);
});

/** The `/:date/:memberId` of a request: a real date and one of this Family's Members, or the answer to send. */
async function memberDay(
  c: Context<AppEnv>,
): Promise<{ ok: true; date: string; memberId: string } | { ok: false; response: Response }> {
  const date = c.req.param("date") ?? "";
  const memberId = c.req.param("memberId") ?? "";
  if (!isCalendarDate(date)) return { ok: false, response: invalidDate(c) };
  if (!(await membersOfFamily(c.env.DB, c.get("familyId"), [memberId])).has(memberId)) {
    return { ok: false, response: notFound(c) };
  }
  return { ok: true, date, memberId };
}
