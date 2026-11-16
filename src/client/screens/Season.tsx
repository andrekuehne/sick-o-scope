import { useMemo, useState } from "react";
import type { Me } from "../../shared/auth.ts";
import type { Severity } from "../../shared/check-ins.ts";
import { createHistory, type Season, type SeasonStats, type Streak, seasonOf } from "../../shared/history.ts";
import { useAllCheckIns } from "../check-ins.ts";
import { MemberAvatar } from "../components/MemberAvatar.tsx";
import { SeasonBar } from "../components/SeasonBar.tsx";
import { dateRangeWithYear, useLocalToday } from "../dates.ts";
import { t } from "../strings.ts";

/**
 * The Season ("Saison"): one card per Member with the Season's numbers, and the best Streaks
 * ever ("Rekorde"). It opens on the current Season; earlier ones with Check-ins can be picked.
 * Everything comes from all of the Family's Check-ins, loaded in one go.
 */
export function SeasonScreen({ me }: { me: Me }) {
  const today = useLocalToday();
  const currentSeason = seasonOf(today);
  const [seasonStart, setSeasonStart] = useState(currentSeason.start);
  const season = seasonOf(seasonStart);
  const checkIns = useAllCheckIns(me.family.id);
  const history = useMemo(() => createHistory(me.members, checkIns.data ?? []), [me.members, checkIns.data]);
  const bests = useMemo(() => history.bestStreaks(), [history]);
  const stats = history.seasonStats(season);
  // The Seasons with Check-ins, and the current one even before anything's logged in it.
  const seasons = useMemo(() => seasonsWithCheckIns(checkIns.data ?? [], seasonOf(today)), [checkIns.data, today]);
  const shown = seasons.findIndex((s) => s.start === season.start);

  return (
    <section className="screen">
      <h1>{t.season.title}</h1>

      <SeasonBar
        season={season}
        previous={seasons[shown - 1] ?? null}
        next={seasons[shown + 1] ?? null}
        onChange={(picked) => setSeasonStart(picked.start)}
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
                <SeasonRow key={row.member.id} stats={row} />
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
function SeasonRow({ stats }: { stats: SeasonStats }) {
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
        <span className="member-name">{member.name}</span>
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

/** The Seasons that have Check-ins, plus the current one, oldest first. */
function seasonsWithCheckIns(checkIns: { date: string }[], current: Season): Season[] {
  const byStart = new Map([[current.start, current]]);
  for (const { date } of checkIns) {
    const season = seasonOf(date);
    byStart.set(season.start, season);
  }
  return [...byStart.values()].sort((a, b) => (a.start < b.start ? -1 : 1));
}

function severityText(severity: Severity): string {
  return `${t.severityIcon[severity]} ${t.severity[severity]}`;
}
