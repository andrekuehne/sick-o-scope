import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { REMINDER_TIMES } from "../../shared/reminders.ts";
import { deleteReminder, fetchReminder, saveReminder } from "../api.ts";
import { useOnline } from "../online.ts";
import { allowNotifications, endPushSubscription, notificationsBlocked, pushAvailable, pushSubscription } from "../push.ts";
import { t } from "../strings.ts";

/** The time offered before a Reminder was ever set. */
const DEFAULT_TIME = "20:00";

type Change = { on: boolean; time: string };

/**
 * Erinnerung: this Device's daily Reminder, on or off, at a quarter hour of the Device's own
 * timezone. Every Device has its own; switching on asks for permission to notify.
 */
export function ReminderSettings({ familyId }: { familyId: string }) {
  const queryClient = useQueryClient();
  const reminderKey = ["reminder", familyId];
  const settings = useQuery({ queryKey: reminderKey, queryFn: () => fetchReminder(familyId) });
  const available = pushAvailable();
  const [blocked, setBlocked] = useState(notificationsBlocked);
  const [draftTime, setDraftTime] = useState(DEFAULT_TIME);
  const online = useOnline();

  const change = useMutation({
    mutationFn: async ({ on, time }: Change) => {
      if (!on) {
        await deleteReminder(familyId);
        await endPushSubscription();
        return;
      }
      const allowed = await allowNotifications();
      // A prompt dismissed without an answer isn't blocked: switching on asks again.
      setBlocked(notificationsBlocked());
      if (!allowed || !settings.data) return;
      const subscription = await pushSubscription(settings.data.vapidPublicKey);
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      await saveReminder(familyId, { time, timeZone, subscription });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: reminderKey }),
  });

  const saved = settings.data?.reminder ?? null;
  // While a change is on its way, show what it will be rather than what was.
  const shown: Change = change.isPending ? change.variables : { on: saved !== null, time: saved?.time ?? draftTime };
  const busy = !online || !settings.data || change.isPending;

  return (
    <>
      <h2>{t.reminder.title}</h2>
      <p className="muted">{t.reminder.intro}</p>
      {!available ? (
        <p className="notice">{t.reminder.unavailable}</p>
      ) : (
        <div className="card reminder-card">
          <label className="toggle-row">
            <input
              type="checkbox"
              role="switch"
              checked={shown.on}
              disabled={busy}
              onChange={(e) => change.mutate({ on: e.target.checked, time: shown.time })}
            />
            <span>{t.reminder.on}</span>
          </label>
          <label className="field">
            <span>{t.reminder.time}</span>
            <select
              value={shown.time}
              disabled={busy}
              onChange={(e) => {
                setDraftTime(e.target.value);
                // Off, the time only waits for switching on; on, it is saved right away.
                if (shown.on) change.mutate({ on: true, time: e.target.value });
              }}
            >
              {REMINDER_TIMES.map((time) => (
                <option key={time} value={time}>
                  {time}
                </option>
              ))}
            </select>
          </label>
          {blocked && <p className="notice">{t.reminder.blocked}</p>}
          {change.isError && <p className="notice">{t.offlineOrError}</p>}
        </div>
      )}
    </>
  );
}
