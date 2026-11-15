// Calendar dates in the UI: today on this phone, and dates in the UI's language. Dates are
// days, not moments, so they are formatted in UTC and never shift with the phone's timezone
// (see src/shared/dates.ts).

import { useEffect, useState } from "react";
import { addDays, localToday } from "../shared/dates.ts";
import { t } from "./strings.ts";

const shortFormat = new Intl.DateTimeFormat(t.locale, { day: "numeric", month: "short", timeZone: "UTC" });
const weekdayFormat = new Intl.DateTimeFormat(t.locale, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const monthFormat = new Intl.DateTimeFormat(t.locale, { month: "short", timeZone: "UTC" });
const monthYearFormat = new Intl.DateTimeFormat(t.locale, { month: "short", year: "numeric", timeZone: "UTC" });

/** Today's local date, kept current across midnight and when the app comes back to the front. */
export function useLocalToday(): string {
  const [today, setToday] = useState(localToday);
  useEffect(() => {
    const update = () => setToday(localToday());
    const timer = setInterval(update, 60_000);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  return today;
}

/** "Heute, 15. Nov.", "Gestern, 14. Nov." or "Fr., 13. Nov." */
export function dayLabel(date: string, today: string): string {
  if (date === today) return `${t.today.todayPrefix}, ${shortDate(date)}`;
  if (date === addDays(today, -1)) return `${t.today.yesterdayPrefix}, ${shortDate(date)}`;
  return weekdayDate(date);
}

/** "15. Nov." */
export function shortDate(date: string): string {
  return shortFormat.format(utcDate(date));
}

/** "12.–14. Nov.", or "28. Okt. – 3. Nov." across months. */
export function shortDateRange(from: string, to: string): string {
  return shortFormat.formatRange(utcDate(from), utcDate(to));
}

/** "Fr., 13. Nov." */
export function weekdayDate(date: string): string {
  return weekdayFormat.format(utcDate(date));
}

/** "Nov.", or "Jan. 2027" when `withYear`. */
export function monthLabel(date: string, withYear: boolean): string {
  return (withYear ? monthYearFormat : monthFormat).format(utcDate(date));
}

function utcDate(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}
