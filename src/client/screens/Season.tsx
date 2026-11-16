import { useMemo } from "react";
import { Link } from "react-router";
import type { Me } from "../../shared/auth.ts";
import { createHistory, type Season, type SeasonStats, type Streak, seasonOf } from "../../shared/history.ts";
import { useAllCheckIns } from "../check-ins.ts";
import { MemberAvatar } from "../components/MemberAvatar.tsx";
import { SeasonBar } from "../components/SeasonBar.tsx";
import { dateRangeWithYear, useLocalToday } from "../dates.ts";
import { personPath, seasonsToPick, useSeasonChoice } from "../season-choice.ts";
import { severityText, t } from "../strings.ts";

/**
 * The Season ("Saison"): one card per Member with the Season's numbers, and the best Streaks
 * ever ("Rekorde"). It opens on the current Season; earlier ones with Check-ins can be picked.
 * Tapping a Member's card opens their Person screen on the same Season.
 * Everything comes from all of the Family's Check-ins, loaded in one go.
 */
export function SeasonScreen({ me }: { me: Me }) {
  const today = useLocalToday();
  const [season, setSeason] = useSeasonChoice(today);
  const checkIns = useAllCheckIns(me.family.id);
  const history = useMemo(() => createHistory(me.members, checkIns.data ?? []), [me.members, checkIns.data]);
  const bests = useMemo(() => history.bestStreaks(), [history]);
  const stats = history.seasonStats(season);
  // The Seasons with Check-ins, and the current one even before anything's logged in it.
  const seasons = useMemo(() => seasonsToPick(checkIns.data ?? [], seasonOf(today), season), [checkIns.data, today, season]);
  const shown = seasons.findIndex((s) => s.start === season.start);

  return (
    <section className="screen">
      <h1>{t.season.title}</h1>

      <SeasonBar
        season={season}
        previous={seasons[shown - 1] ?? null}
        next={seasons[shown + 1] ?? null}
        onChange={setSeason}
      />

      {checkIns.isPending ? (
        <p className="muted">{t.loading}</p>
      ) : checkIns.data === undefined ? (
        <p className="notice">{t.offlineOrError}</p>
      ) : (
        <>
          {stats.length === 0 ? (
            <p className="muted">{t.season.empty}</p>
          ) : (
            <ul className="season-table" aria-label={t.season.table}>
              {stats.map((row) => (
                <SeasonRow key={row.member.id} stats={row} season={season} />
              ))}
            </ul>
          )}

          <h2>{t.season.records}</h2>
          <RecordList
            entries={[
              { key: "family", label: t.season.familyHealthy, streak: bests.familyHealthy },
              { key: "logging", label: t.season.logging, streak: bests.logging },
              ...bests.members.map(({ member, healthy }) => ({
                key: member.id,
                label: t.season.memberHealthy(member.emoji, member.name),
                streak: healthy,
              })),
            ]}
          />
        </>
      )}
      {checkIns.isError && checkIns.data !== undefined && <p className="notice">{t.offlineOrError}</p>}
    </section>
  );
}

/** One Member's Season, as a card: their numbers, each with what it means. */
function SeasonRow({ stats, season }: { stats: SeasonStats; season: Season }) {
  const { member } = stats;
  const days = (n: number | null) => (n === null ? t.season.none : t.days(n));
  const cells: [string, string][] = [
    [t.season.sickDays, t.days(stats.sickDays)],
    [t.season.bugs, String(stats.bugs)],
    [t.season.longestBug, days(stats.longestBug)],
    [t.season.longestHealthyStreak, days(stats.longestHealthyStreak)],
    [t.season.worstDay, stats.worstSeverity === null ? t.season.none : severityText(stats.worstSeverity)],
  ];
  return (
    <li className="card season-row" aria-label={member.name}>
      <div className="season-row-head">
        <MemberAvatar member={member} />
        <Link className="member-name season-row-link" to={personPath(member.id, season)}>
          {member.name}
        </Link>
        <span className="chevron" aria-hidden="true">
          ›
        </span>
      </div>
      <dl className="season-stats">
        {cells.map(([label, value]) => (
          <div key={label} className="season-stat">
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </li>
  );
}

function RecordList({ entries }: { entries: { key: string; label: string; streak: Streak | null }[] }) {
  const withStreak = entries.filter((entry) => entry.streak !== null);
  if (withStreak.length === 0) return <p className="muted">{t.season.noRecords}</p>;
  return (
    <ul className="record-list">
      {withStreak.map(({ key, label, streak }) => (
        <li key={key} className="record">
          <span>{label}</span>
          <strong>{streak && t.season.record(streak.days, dateRangeWithYear(streak.from, streak.to))}</strong>
        </li>
      ))}
    </ul>
  );
}
