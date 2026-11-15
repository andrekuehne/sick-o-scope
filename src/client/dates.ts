// Showing calendar dates in the UI's language. Dates are days, not moments, so they are
// formatted in UTC and never shift with the phone's timezone (see src/shared/dates.ts).

import { t } from "./strings.ts";

const shortFormat = new Intl.DateTimeFormat(t.locale, { day: "numeric", month: "short", timeZone: "UTC" });
const weekdayFormat = new Intl.DateTimeFormat(t.locale, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

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

function utcDate(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}
