import { useState } from "react";
import type { GapProposal } from "../shared/history.ts";
import { loadKeys, saveKeys } from "./device-keys.ts";

const STORAGE_KEY = "sick-o-scope:dismissed-gaps";
/** Enough for any Family; older dismissals have long since stopped mattering. */
const KEEP = 50;

/**
 * Which gap-fill cards this device has dismissed. A dismissal is remembered per Member and
 * first missed day, so it holds while the days go by, until the Member is logged again.
 */
export function useDismissedGapProposals() {
  const [dismissed, setDismissed] = useState(() => loadKeys(STORAGE_KEY));
  return {
    isDismissed: (proposal: GapProposal) => runKeys(proposal).every((key) => dismissed.includes(key)),
    dismiss: (proposal: GapProposal) => {
      const next = [...dismissed, ...runKeys(proposal)].slice(-KEEP);
      setDismissed(next);
      saveKeys(STORAGE_KEY, next, KEEP);
    },
  };
}

/** One key per Member's run of Gaps: the Member and the first day they missed. */
function runKeys(proposal: GapProposal): string[] {
  return proposal.members.map(({ member }) => `${member.id}|${proposal.from}`);
}
