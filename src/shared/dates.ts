// Calendar dates ("2026-11-15"): a day in the Family's life, not a moment in time.
// Arithmetic runs in UTC so it never trips over daylight-saving changes.

import { z } from "zod";

/** True for a real date in YYYY-MM-DD form ("2026-02-30" is not). */
export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export const CalendarDate = z.string().refine(isCalendarDate, "a real date like 2026-11-15");

/** The date `days` later (or earlier, when negative). */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Today on this device's clock, as the Family experiences it. */
export function localToday(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Today in UTC: the server's notion of today, which can be a day off from the Family's. */
export function utcToday(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Every date from `from` to `to`, both included. */
export function datesBetween(from: string, to: string): string[] {
  const dates: string[] = [];
  for (let date = from; date <= to; date = addDays(date, 1)) dates.push(date);
  return dates;
}

/** Days from `from` to `to`, both included (0 when `to` is before `from`). */
export function daysBetweenInclusive(from: string, to: string): number {
  const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  return Math.max(0, Math.round(ms / 86_400_000) + 1);
}
