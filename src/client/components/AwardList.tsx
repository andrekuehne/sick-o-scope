import type { Award, Season, SeasonAward } from "../../shared/history.ts";
import { symptom } from "../../shared/symptoms.ts";
import { shortDate } from "../dates.ts";
import { severityText, t } from "../strings.ts";

/**
 * A Season's Awards under their heading, "Stand heute" while the Season runs. With `holders`,
 * each says who holds it (the Saison tab); without, they're one Member's own (the Person screen).
 */
export function AwardList({
  awards,
  season,
  today,
  holders = false,
}: {
  awards: SeasonAward[];
  season: Season;
  today: string;
  holders?: boolean;
}) {
  const running = today <= season.end;
  return (
    <>
      <h2>
        {t.awards.title}
        {running && <small className="muted award-so-far"> {t.awards.soFar}</small>}
      </h2>
      <ul className="record-list" aria-label={t.awards.title}>
        {awards.map(({ award, members }) => {
          const { title, reason } = describe(award);
          return (
            <li key={JSON.stringify(award)} className="record award">
              <strong>{title}</strong>
              {holders && <span>{t.awards.holders(members.map((m) => m.name))}</span>}
              <span className="muted award-reason">{reason}</span>
            </li>
          );
        })}
      </ul>
    </>
  );
}

/** An Award's title, and what it was won with. */
function describe(award: Award): { title: string; reason: string } {
  if (award.kind === "symptom-champion") {
    const { badge, name } = symptom(award.symptom);
    return { title: t.awards.champion(award.symptom, badge, name), reason: t.awards.reason.champion(name, award.days) };
  }
  return { title: t.awards.name[award.kind], reason: reasonFor(award) };
}

/** What one of the named Awards was won with. */
function reasonFor(award: Exclude<Award, { kind: "symptom-champion" }>): string {
  const { reason } = t.awards;
  switch (award.kind) {
    case "iron-defence":
      return reason.ironDefence(award.days);
    case "virus-collector":
      return reason.virusCollector(award.bugs);
    case "sofa-pro":
      return reason.sofaPro(award.days);
    case "bounce-back":
      return reason.bounceBack(award.days);
    case "bravery":
      return reason.bravery(severityText(award.severity), award.days);
    case "season-opener":
      return reason.seasonOpener(shortDate(award.date));
    case "wave-rider":
      return reason.waveRider(award.waves);
    case "unbreakable":
      return reason.unbreakable;
    case "mystery":
      return reason.mystery;
  }
}
