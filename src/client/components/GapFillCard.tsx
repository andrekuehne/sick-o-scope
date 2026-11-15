import type { CheckInState, FillGapsRequest } from "../../shared/check-ins.ts";
import { type GapProposal, missedDays } from "../../shared/history.ts";
import { shortDateRange } from "../dates.ts";
import { t } from "../strings.ts";
import { MemberAvatar } from "./MemberAvatar.tsx";

/**
 * "Luna: 3 Tage fehlen (12.–14. Nov.)" with Alle fit, Wie zuletzt and Einzeln eintragen.
 * Alle fit and Wie zuletzt only ever write into Gaps; dismissing writes nothing.
 */
export function GapFillCard({
  proposal,
  busy,
  onFill,
  onOneByOne,
  onDismiss,
}: {
  proposal: GapProposal;
  busy: boolean;
  onFill: (checkIns: FillGapsRequest["checkIns"]) => void;
  onOneByOne: () => void;
  onDismiss: () => void;
}) {
  const names = new Intl.ListFormat(t.locale, { type: "conjunction" }).format(proposal.members.map((m) => m.member.name));
  const title = t.gapFill.title(names, proposal.days, shortDateRange(proposal.from, proposal.to));
  const fillWith = (stateOf: (last: CheckInState) => CheckInState) =>
    onFill(missedDays(proposal).map(({ member, last, date }) => ({ ...stateOf(last), memberId: member.id, date })));

  return (
    <section className="gap-fill" aria-label={title}>
      <div className="gap-fill-head">
        <span className="gap-fill-avatars">
          {proposal.members.map(({ member }) => (
            <MemberAvatar key={member.id} member={member} />
          ))}
        </span>
        <p className="gap-fill-title">{title}</p>
        <button
          type="button"
          className="icon-button"
          aria-label={t.gapFill.dismiss}
          title={t.gapFill.dismiss}
          onClick={onDismiss}
        >
          ✖️
        </button>
      </div>
      <div className="gap-fill-actions">
        <button
          type="button"
          className="button primary"
          disabled={busy}
          onClick={() => fillWith(() => ({ status: "healthy", note: null }))}
        >
          {t.gapFill.allHealthy}
        </button>
        <button type="button" className="button" disabled={busy} onClick={() => fillWith((last) => last)}>
          {t.gapFill.likeLast}
        </button>
        <button type="button" className="button" disabled={busy} onClick={onOneByOne}>
          {t.gapFill.oneByOne}
        </button>
      </div>
    </section>
  );
}
