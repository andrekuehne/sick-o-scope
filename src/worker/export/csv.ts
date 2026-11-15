// The CSV export: every Check-in of a Family, one row each, for spreadsheet apps.
// The file is German like the app; its words live here because the Worker writes it
// (see the header of src/client/strings.ts). Two deliberate choices:
// - Times are UTC, as stored, and the header says so: the server doesn't know the Family's timezone.
// - Text starting like a formula (=, +, -, @) gets a leading apostrophe, so a spreadsheet shows
//   it as text instead of running it (a note "- besser" would otherwise be a formula error).

import type { CheckIn } from "../../shared/check-ins.ts";
import { inCatalogOrder, symptom } from "../../shared/symptoms.ts";
import type { CheckInWithMemberName } from "../check-ins/check-ins.ts";

const HEADER = ["Datum", "Familienmitglied", "Status", "Schweregrad", "Symptome", "Notiz", "Geändert von", "Geändert am (UTC)"];

/**
 * The CSV text, with a byte order mark so Excel reads it as UTF-8. Fields are separated by
 * semicolons, which German Excel expects (others detect them), and rows end in CRLF.
 */
export function checkInsCsv(checkIns: CheckInWithMemberName[]): string {
  const rows = checkIns.map((c) => [
    c.date,
    c.memberName,
    ...statusFields(c),
    c.note ?? "",
    c.updatedBy ?? "",
    // "2026-11-15 08:00:00": a form spreadsheets take as a date and time.
    c.updatedAt.slice(0, 19).replace("T", " "),
  ]);
  return `﻿${[HEADER, ...rows].map((row) => row.map(field).join(";")).join("\r\n")}\r\n`;
}

/** Status, Severity and Symptoms (German names, in catalog order). */
function statusFields(checkIn: CheckIn): [string, string, string] {
  if (checkIn.status === "healthy") return ["Fit", "", ""];
  const symptoms = inCatalogOrder(checkIn.symptoms).map((key) => symptom(key).name);
  return ["Krank", String(checkIn.severity), symptoms.join(", ")];
}

/**
 * One field, quoted when it holds a separator, a quote or a line break. Commas count too:
 * an app that splits on commas would otherwise cut "Husten, Fieber" in two.
 */
function field(value: string): string {
  const text = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[;,"\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
