// Check-ins: one Member's record for one calendar date, either Healthy or Sick
// (GLOSSARY.md). No Check-in for a date is a Gap, never Healthy.

import { z } from "zod";
import { CalendarDate } from "./dates.ts";
import { MEDICATION_KEYS } from "./medications.ts";
import { SYMPTOM_KEYS } from "./symptoms.ts";

/** How bad a Sick day was overall, from 0 (Fast gesund) to 5 (Totalausfall). */
export const Severity = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]);
export type Severity = z.infer<typeof Severity>;

/** A Symptom's stable key from the fixed catalog, e.g. "runny-nose"; anything else is rejected. */
export const SymptomKey = z.enum(SYMPTOM_KEYS);

/** A Medication's stable key from the fixed catalog, e.g. "ibuprofen"; anything else is rejected. */
export const MedicationKey = z.enum(MEDICATION_KEYS);

export const NOTE_MAX_LENGTH = 500;

/** An optional short note; blank means none. */
const Note = z
  .string()
  .trim()
  .max(NOTE_MAX_LENGTH)
  .nullish()
  .transform((note) => note || null);

// Strict: a Healthy day with a Severity (or any other mix) is rejected, not silently trimmed.
const HealthyState = z.object({ status: z.literal("healthy"), note: Note }).strict();
const SickState = z
  .object({
    status: z.literal("sick"),
    severity: Severity,
    symptoms: z
      .array(SymptomKey)
      .max(20)
      .refine((keys) => new Set(keys).size === keys.length, "each Symptom at most once")
      .default([]),
    /** The Medications taken that day; left out means none, like Symptoms. */
    medications: z
      .array(MedicationKey)
      .max(MEDICATION_KEYS.length)
      .refine((keys) => new Set(keys).size === keys.length, "each Medication at most once")
      .default([]),
    note: Note,
    /**
     * This day starts a new Bug ("Neuer Infekt") although the previous Check-in was Sick.
     * Missing means it continues the Bug, which is also what apps from before Bugs send.
     */
    newBug: z.boolean().default(false),
  })
  .strict();

/** The complete state of one Member's day, as a User saves it (it replaces what was there). */
export const CheckInState = z.discriminatedUnion("status", [HealthyState, SickState]);
export type CheckInState = z.output<typeof CheckInState>;
export type CheckInStateInput = z.input<typeof CheckInState>;

const Saved = {
  memberId: z.string(),
  date: CalendarDate,
  /** Display name of the User who saved it last; null when that User was removed. */
  updatedBy: z.string().nullable(),
  updatedAt: z.string(),
};

/** A saved Check-in as the API returns it. */
export const CheckIn = z.discriminatedUnion("status", [HealthyState.extend(Saved), SickState.extend(Saved)]);
export type CheckIn = z.output<typeof CheckIn>;

const MemberDay = z.object({ memberId: z.string(), date: CalendarDate });

/**
 * Body of fill-gaps: complete Check-ins, written only where a Member has none for that date.
 * Each one is as strict as a single saved day. Up to two weeks for a large Family.
 */
export const FillGapsRequest = z.object({
  checkIns: z
    .array(z.discriminatedUnion("status", [HealthyState.extend(MemberDay.shape), SickState.extend(MemberDay.shape)]))
    .min(1)
    .max(200),
});
export type FillGapsRequest = z.input<typeof FillGapsRequest>;

/** Answer of fill-gaps: which days were written, and which already had a Check-in. */
export const FillGapsResult = z.object({ written: z.array(MemberDay), skipped: z.array(MemberDay) });
export type FillGapsResult = z.infer<typeof FillGapsResult>;
