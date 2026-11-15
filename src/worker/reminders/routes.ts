import { Hono } from "hono";
import { ReminderInput, type ThisDeviceReminder } from "../../shared/reminders.ts";
import type { AppEnv } from "../app-env.ts";
import { parseBody } from "../http.ts";
import { deleteReminder, reminderOf, saveReminder } from "./reminders.ts";

/**
 * This Device's Reminder: only ever the Device making the request, never another one.
 * Mounted inside the Family guard (families/routes.ts).
 */
export const reminderRoutes = new Hono<AppEnv>();

reminderRoutes.get("/reminder", async (c) => {
  const reminder = await reminderOf(c.env.DB, c.get("familyId"), c.get("user").deviceId);
  return c.json({ reminder, vapidPublicKey: c.env.VAPID_PUBLIC_KEY } satisfies ThisDeviceReminder);
});

reminderRoutes.put("/reminder", async (c) => {
  const body = await parseBody(c, ReminderInput);
  if (!body.ok) return body.response;
  await saveReminder(c.env.DB, {
    familyId: c.get("familyId"),
    deviceId: c.get("user").deviceId,
    input: body.data,
    now: new Date(),
  });
  return c.json({ reminder: { time: body.data.time } });
});

reminderRoutes.delete("/reminder", async (c) => {
  await deleteReminder(c.env.DB, c.get("familyId"), c.get("user").deviceId);
  return c.body(null, 204);
});
