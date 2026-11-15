import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import type { Me } from "../../shared/auth.ts";
import { addDays, isCalendarDate, localToday } from "../../shared/dates.ts";
import { createHistory, type DayStatus } from "../../shared/history.ts";
import type { Member } from "../../shared/members.ts";
import { useCheckIns, useCheckInWrites } from "../check-ins.ts";
import { MemberAvatar } from "../components/MemberAvatar.tsx";
import { t } from "../strings.ts";

/** The daily Check-in screen: one card per Member for the chosen date (default: today). */
export function TodayScreen({ me }: { me: Me }) {
  const today = useLocalToday();
  const [params, setParams] = useSearchParams();
  const requested = params.get("tag") ?? "";
  // Only real dates up to today; anything else shows today.
  const date = isCalendarDate(requested) && requested <= today ? requested : today;
  const setDate = (next: string) => setParams(next === today ? {} : { tag: next }, { replace: true });

  const familyId = me.family.id;
  const checkIns = useCheckIns(familyId, date, date);
  const writes = useCheckInWrites(familyId);
  const day = createHistory(me.members, checkIns.data ?? []).day(date);
  const gaps = day.members.filter((m) => m.status.kind === "gap");

  return (
    <section className="screen">
      <h1>{t.today.greeting(me.user.name)}</h1>
      <p className="muted">{me.family.name}</p>

      <DateBar date={date} today={today} onChange={setDate} />

      {day.total === 0 ? (
        <p className="notice">
          {t.today.noMembers} <Link to="/einstellungen">{t.today.toSettings}</Link>
        </p>
      ) : (
        <>
          <div className="day-summary">
            <span className="muted">{checkIns.isPending ? t.loading : t.today.checkedIn(day.checkedIn, day.total)}</span>
            <button
              type="button"
              className="button primary"
              disabled={checkIns.isPending || writes.busy || gaps.length === 0}
              onClick={() =>
                writes.fill(gaps.map(({ member }) => ({ memberId: member.id, date, status: "healthy" as const })))
              }
            >
              💪 {date === today ? t.today.allHealthyToday : t.today.allHealthyOn(shortDate(date))}
            </button>
          </div>

          <ul className="day-cards">
            {day.members.map(({ member, status }) => (
              <MemberDayCard
                key={`${date}|${member.id}`}
                member={member}
                status={checkIns.isPending ? null : status}
                busy={writes.busy}
                onHealthy={() => writes.save({ date, memberId: member.id, state: { status: "healthy" } })}
                onDelete={() => writes.remove({ date, memberId: member.id })}
              />
            ))}
          </ul>
        </>
      )}
      {(writes.failed || checkIns.isError) && <p className="notice">{t.offlineOrError}</p>}
    </section>
  );
}

function MemberDayCard({
  member,
  status,
  busy,
  onHealthy,
  onDelete,
}: {
  member: Member;
  /** null while loading. */
  status: DayStatus | null;
  busy: boolean;
  onHealthy: () => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <li className="day-card" data-status={status?.kind ?? "loading"} aria-label={member.name}>
      <MemberAvatar member={member} />
      <div className="day-card-main">
        <span className="member-name">{member.name}</span>
        <span className="day-card-status">{status ? statusText(status) : t.loading}</span>
      </div>
      {status?.kind === "gap" && (
        <button
          type="button"
          className="button primary small"
          aria-label={t.today.markHealthyLabel(member.name)}
          disabled={busy}
          onClick={onHealthy}
        >
          {t.today.markHealthy}
        </button>
      )}
      {status && status.kind !== "gap" && !editing && (
        <button
          type="button"
          className="icon-button"
          aria-label={t.today.edit(member.name)}
          title={t.today.edit(member.name)}
          onClick={() => setEditing(true)}
        >
          ✏️
        </button>
      )}
      {editing && status && status.kind !== "gap" && (
        <div className="day-card-edit">
          <button
            type="button"
            className="button small"
            disabled={busy}
            onClick={() => {
              onDelete();
              setEditing(false);
            }}
          >
            {t.today.deleteEntry}
          </button>
          <button type="button" className="button small" onClick={() => setEditing(false)}>
            {t.today.cancel}
          </button>
        </div>
      )}
    </li>
  );
}

function statusText(status: DayStatus): string {
  if (status.kind === "gap") return t.today.gap;
  if (status.kind === "healthy") return t.today.healthy;
  return t.today.sick(t.severity[status.severity]);
}

function DateBar({ date, today, onChange }: { date: string; today: string; onChange: (date: string) => void }) {
  return (
    <nav className="date-bar" aria-label={t.today.dateBar}>
      <button
        type="button"
        className="icon-button"
        aria-label={t.today.previousDay}
        onClick={() => onChange(addDays(date, -1))}
      >
        ◀️
      </button>
      <span className="date-bar-label">{dayLabel(date, today)}</span>
      <button
        type="button"
        className="icon-button"
        aria-label={t.today.nextDay}
        disabled={date >= today}
        onClick={() => onChange(addDays(date, 1))}
      >
        ▶️
      </button>
      <label className="icon-button date-picker" title={t.today.pickDate}>
        <span aria-hidden="true">📅</span>
        <input
          type="date"
          aria-label={t.today.pickDate}
          value={date}
          max={today}
          onChange={(e) => {
            const picked = e.target.value;
            if (isCalendarDate(picked) && picked <= today) onChange(picked);
          }}
        />
      </label>
    </nav>
  );
}

/** "Heute, 15. Nov.", "Gestern, 14. Nov." or "Fr., 13. Nov." */
function dayLabel(date: string, today: string): string {
  if (date === today) return `${t.today.todayPrefix}, ${shortDate(date)}`;
  if (date === addDays(today, -1)) return `${t.today.yesterdayPrefix}, ${shortDate(date)}`;
  return new Intl.DateTimeFormat(t.locale, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(
    utcDate(date),
  );
}

function shortDate(date: string): string {
  return new Intl.DateTimeFormat(t.locale, { day: "numeric", month: "short", timeZone: "UTC" }).format(utcDate(date));
}

/** Today's local date, kept current across midnight and when the app comes back to the front. */
function useLocalToday(): string {
  const [today, setToday] = useState(localToday);
  useEffect(() => {
    const update = () => setToday(localToday());
    const timer = setInterval(update, 60_000);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  return today;
}

function utcDate(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}
