import { useMemo } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import type { Me } from "../../shared/auth.ts";
import { createHistory, type MemberOverview, seasonOf } from "../../shared/history.ts";
import { symptom } from "../../shared/symptoms.ts";
import { useAllCheckIns } from "../check-ins.ts";
import { MemberAvatar } from "../components/MemberAvatar.tsx";
import { SeasonBar } from "../components/SeasonBar.tsx";
import { dateRangeWithYear, shortDateRange, useLocalToday } from "../dates.ts";
import { seasonsToPick, useSeasonChoice } from "../season-choice.ts";
import { severityText, t } from "../strings.ts";

/**
 * A Member's Person screen: their whole Season on one page, and their personal records. It
 * opens on the Season it was opened from (the current one from Heute), and has its own
 * address, so Back returns there. Archived Members have one too.
 */
export function PersonScreen({ me }: { me: Me }) {
  const { memberId = "" } = useParams();
  const today = useLocalToday();
  const [season, setSeason] = useSeasonChoice(today);
  const checkIns = useAllCheckIns(me.family.id);
  const history = useMemo(() => createHistory(me.members, checkIns.data ?? []), [me.members, checkIns.data]);
  const person = history.memberOverview(memberId, season, today);
  // The Seasons with this Member's Check-ins.
  const seasons = useMemo(
    () => seasonsToPick((checkIns.data ?? []).filter((c) => c.memberId === memberId), seasonOf(today), season),
    [checkIns.data, memberId, today, season],
  );
  const shown = seasons.findIndex((s) => s.start === season.start);

  if (!person) {
    return (
      <section className="screen">
        <BackButton />
        <h1>{t.notFound.title}</h1>
        <p className="muted">{t.notFound.text}</p>
      </section>
    );
  }
  const { member } = person;

  return (
    <section className="screen">
      <BackButton />
      <div className="person-head">
        <MemberAvatar member={member} />
        <h1>{member.name}</h1>
        {member.archived && <span className="muted">{t.person.archived}</span>}
      </div>

      <SeasonBar season={season} previous={seasons[shown - 1] ?? null} next={seasons[shown + 1] ?? null} onChange={setSeason} />

      {checkIns.isPending ? (
        <p className="muted">{t.loading}</p>
      ) : checkIns.data === undefined ? (
        <p className="notice">{t.offlineOrError}</p>
      ) : (
        <>
          {person.stats ? <PersonSeason person={person} /> : <p className="muted">{t.person.empty(member.name)}</p>}
          {/* The Member's Awards (#19) go here. */}
          <PersonalRecordList person={person} />
        </>
      )}
      {checkIns.isError && checkIns.data !== undefined && <p className="notice">{t.offlineOrError}</p>}
    </section>
  );
}

/** Back to wherever the screen was opened from; to the Saison tab when it was opened directly. */
function BackButton() {
  const navigate = useNavigate();
  const location = useLocation();
  // "default" is the first page this tab opened: there's nothing in the app to go back to.
  const back = () => (location.key === "default" ? navigate("/saison", { replace: true }) : navigate(-1));
  return (
    <button type="button" className="back-button" onClick={back}>
      ◀️ {t.person.back}
    </button>
  );
}

/** The shown Season: numbers, the comparison with the Season before, top Symptoms, and the Bugs. */
function PersonSeason({ person }: { person: MemberOverview }) {
  const { member, stats, bugs, previous } = person;
  if (!stats) return null;
  const before = previous.stats;
  const cells: [string, string][] = [
    [t.season.sickDays, t.days(stats.sickDays)],
    [t.season.bugs, String(stats.bugs)],
    [t.season.longestHealthyStreak, stats.longestHealthyStreak === null ? t.season.none : t.days(stats.longestHealthyStreak)],
  ];

  return (
    <>
      <dl className="season-stats card" aria-label={t.person.numbers}>
        {cells.map(([label, value]) => (
          <div key={label} className="season-stat">
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      <h2>{t.person.compared(previous.season.label)}</h2>
      {before === null ? (
        <p className="muted">{t.person.noPrevious(member.name)}</p>
      ) : (
        <dl className="comparison">
          {(
            [
              [t.season.sickDays, t.days(stats.sickDays), t.days(before.sickDays), stats.sickDays, before.sickDays],
              [t.season.bugs, String(stats.bugs), String(before.bugs), stats.bugs, before.bugs],
            ] as const
          ).map(([label, now, then, nowCount, thenCount]) => (
            <div key={label} className="record">
              <dt>{label}</dt>
              <dd>
                <strong>{now}</strong>{" "}
                <span className="muted">{t.joined([t.person.before(then), t.person.difference(nowCount, thenCount)])}</span>
              </dd>
            </div>
          ))}
        </dl>
      )}

      <h2>{t.person.topSymptoms}</h2>
      {stats.topSymptoms.length === 0 ? (
        <p className="muted">{t.person.noSymptoms}</p>
      ) : (
        <ol className="record-list">
          {stats.topSymptoms.map(({ symptom: key, days }) => {
            const { name, badge } = symptom(key);
            return (
              <li key={key} className="record">
                <span>
                  <span aria-hidden="true">{badge}</span> {name}
                </span>
                <strong>{t.days(days)}</strong>
              </li>
            );
          })}
        </ol>
      )}

      <h2>{t.person.bugs}</h2>
      {bugs.length === 0 ? (
        <p className="muted">{t.person.noBugs}</p>
      ) : (
        <ul className="record-list" aria-label={t.person.bugs}>
          {bugs.map((bug) => (
            <li key={bug.from} className="record">
              <span>
                <strong>{t.person.bug(bug.number)}</strong> · {shortDateRange(bug.from, bug.to)}
              </span>
              <span>{t.joined([t.days(bug.length), t.person.worstDay(severityText(bug.worstSeverity))])}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/** The Member's own records, over all Seasons. */
function PersonalRecordList({ person }: { person: MemberOverview }) {
  const { longestHealthyStreak: streak, fewestSickDays: fewest } = person.records;
  return (
    <>
      <h2>{t.person.records}</h2>
      <ul className="record-list" aria-label={t.person.records}>
        <li className="record">
          <span>{t.person.longestHealthyStreak}</span>
          <strong>
            {streak ? t.season.record(streak.days, dateRangeWithYear(streak.from, streak.to)) : t.person.noRecordYet}
          </strong>
        </li>
        <li className="record">
          <span>{t.person.fewestSickDays}</span>
          <strong>
            {fewest ? t.person.fewestSickDaysRecord(fewest.sickDays, fewest.season.label) : t.person.afterFirstSeason}
          </strong>
        </li>
      </ul>
    </>
  );
}
