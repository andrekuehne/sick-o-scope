import { useEffect, useState } from "react";
import { loadKeys, saveKeys } from "./device-keys.ts";

const STORAGE_KEY = "sick-o-scope:celebrated";
/** Plenty: a key only matters while its Streak lasts. */
const KEEP = 50;

/** Something Heute celebrates once: `key` names the Streak (by its first day) and the Milestone. */
export type Celebration = { key: string; text: string };

/**
 * The celebrations to show now: those due that this Device hasn't shown yet. Each one is
 * remembered as soon as it shows and stays on screen until Heute is left, so it shows once per
 * Device. Without storage (private mode, blocked), it shows again the next time instead.
 */
export function useCelebrations(due: Celebration[]): Celebration[] {
  const [shownBefore] = useState(() => loadKeys(STORAGE_KEY));
  const [showing, setShowing] = useState<Celebration[]>([]);
  const fresh = due.filter((c) => !shownBefore.includes(c.key) && !showing.some((s) => s.key === c.key));
  // A string, so the effect runs when something new is due, not on every render's new array.
  const freshKeys = fresh.map((c) => c.key).join(" ");

  useEffect(() => {
    if (fresh.length === 0) return;
    // Skips what's already showing: React may run this twice (StrictMode in development).
    setShowing((current) => [...current, ...fresh.filter((c) => !current.some((s) => s.key === c.key))]);
    saveKeys(STORAGE_KEY, [...loadKeys(STORAGE_KEY), ...fresh.map((c) => c.key)], KEEP);
  }, [freshKeys]);

  return showing;
}
