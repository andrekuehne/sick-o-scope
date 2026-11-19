// The CSV export: every Check-in of a Family, one row each, for spreadsheet apps.
// The file is German like the app; its words live here because the Worker writes it
// (see the header of src/client/strings.ts). Two deliberate choices:
// - Times are UTC, as stored, and the header says so: the server doesn't know the Family's timezone.
// - Text starting like a formula (=, +, -, @) gets a leading apostrophe, so a spreadsheet shows
//   it as text instead of running it (a note "- besser" would otherwise be a formula error).

import type { CheckIn } from "../../shared/check-ins.ts";
import { createHistory, type History } from "../../shared/history.ts";
import type { Member } from "../../shared/members.ts";
import { medication, medicationsInCatalogOrder } from "../../shared/medications.ts";
import { symptom, symptomsInCatalogOrder } from "../../shared/symptoms.ts";
import type { CheckInWithMemberName } from "../check-ins/check-ins.ts";

const HEADER = ["Datum", "Familienmitglied", "Status", "Schweregrad", "Symptome", "Medikamente", "Infekt", "Notiz", "Geändert von", "Geändert am (UTC)"];

/**
 * The CSV text, with a byte order mark so Excel reads it as UTF-8. Fields are separated by
 * semicolons, which German Excel expects (others detect them), and rows end in CRLF.
 * `checkIns` are all of the Family's, so each Sick day's Bug can be told.
 */
export function checkInsCsv(checkIns: CheckInWithMemberName[], members: Member[]): string {
  const history = createHistory(members, checkIns);
  const rows = checkIns.map((c) => [
    c.date,
    c.memberName,
    ...statusFields(c),
    bugField(history, c),
    c.note ?? "",
    c.updatedBy ?? "",
    // "2026-11-15 08:00:00": a form spreadsheets take as a date and time.
    c.updatedAt.slice(0, 19).replace("T", " "),
  ]);
  return `﻿${[HEADER, ...rows].map((row) => row.map(field).join(";")).join("\r\n")}\r\n`;
}

/** Status, Severity, Symptoms and Medications (German names, in catalog order). */
function statusFields(checkIn: CheckIn): [string, string, string, string] {
  if (checkIn.status === "healthy") return ["Fit", "", "", ""];
  const symptoms = symptomsInCatalogOrder(checkIn.symptoms).map((key) => symptom(key).name);
  const medications = medicationsInCatalogOrder(checkIn.medications).map((key) => medication(key).name);
  return ["Krank", String(checkIn.severity), symptoms.join(", "), medications.join(", ")];
}

/** The Bug a Sick day belongs to, as its Season and number there: "2026/27 #3". */
function bugField(history: Pick<History, "bugOn">, checkIn: CheckIn): string {
  const bug = history.bugOn(checkIn.memberId, checkIn.date)?.bug;
  return bug ? `${bug.season} #${bug.number}` : "";
}

/**
 * One field, quoted when it holds a separator, a quote or a line break. Commas count too:
 * an app that splits on commas would otherwise cut "Husten, Fieber" in two.
 */
function field(value: string): string {
  const text = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[;,"\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
