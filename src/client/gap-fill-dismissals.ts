import { useState } from "react";
import type { GapProposal } from "../shared/history.ts";

const STORAGE_KEY = "sick-o-scope:dismissed-gaps";
/** Enough for any Family; older dismissals have long since stopped mattering. */
const KEEP = 50;

/**
 * Which gap-fill cards this device has dismissed. A dismissal is remembered per Member and
 * first missed day, so it holds while the days go by, until the Member is logged again.
 */
export function useDismissedGapProposals() {
  const [dismissed, setDismissed] = useState<string[]>(load);
  return {
    isDismissed: (proposal: GapProposal) => runKeys(proposal).every((key) => dismissed.includes(key)),
    dismiss: (proposal: GapProposal) => {
      const next = [...dismissed, ...runKeys(proposal)].slice(-KEEP);
      setDismissed(next);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Not stored: it only stays dismissed until the app is reopened.
      }
    },
  };
}

/** One key per Member's run of Gaps: the Member and the first day they missed. */
function runKeys(proposal: GapProposal): string[] {
  return proposal.members.map(({ member }) => `${member.id}|${proposal.from}`);
}

function load(): string[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(stored) ? stored.filter((key) => typeof key === "string") : [];
  } catch {
    return [];
  }
}
