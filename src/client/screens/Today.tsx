import { useState } from "react";
import { useSearchParams } from "react-router";
import type { Me } from "../../shared/auth.ts";
import { addDays, daysBetweenInclusive, isCalendarDate } from "../../shared/dates.ts";
import type { CheckIn, CheckInState } from "../../shared/check-ins.ts";
import { type BugDay, createHistory, type DayStatus, type History, missedDays, seasonOf, type Shortcut } from "../../shared/history.ts";
import type { Member } from "../../shared/members.ts";
import { inCatalogOrder, symptom } from "../../shared/symptoms.ts";
import { BUG_LOOKBACK_DAYS, MAX_RANGE_DAYS, useCheckIns, useCheckInWrites } from "../check-ins.ts";
import { CheckInSheet } from "../components/CheckInSheet.tsx";
import { GapFillCard } from "../components/GapFillCard.tsx";
import { MemberAvatar } from "../components/MemberAvatar.tsx";
import { NoMembersNotice } from "../components/NoMembersNotice.tsx";
import { dayLabel, shortDate, useLocalToday } from "../dates.ts";
import { useDismissedGapProposals } from "../gap-fill-dismissals.ts";
import { t } from "../strings.ts";

/** How far back the screen loads Check-ins, which is as far back as Streaks can reach. */
const HISTORY_DAYS = 365;

/** Recent days share one loaded range, ending today. */
const RECENT_DAYS = 180;

/** The shortcuts that follow a Sick day (Besser, Gleich, Schlechter), in the order the card shows them. */
const AFTER_SICK_DAY = ["better", "same", "worse"] as const satisfies readonly Shortcut[];
type ShortcutOffer = { shortcut: (typeof AFTER_SICK_DAY)[number]; state: CheckInState };

/** One Member's day in the editor sheet; Einzeln eintragen walks through several. */
type SheetStep = { member: Member; date: string; startAs: CheckIn["status"] };

/** The daily Check-in screen: one card per Member for the chosen date (default: today). */
export function TodayScreen({ me }: { me: Me }) {
  const today = useLocalToday();
  const [params, setParams] = useSearchParams();
  const requested = params.get("tag") ?? "";
  // Only real dates up to today; anything else shows today.
  const date = isCalendarDate(requested) && requested <= today ? requested : today;
  const setDate = (next: string) => setParams(next === today ? {} : { tag: next }, { replace: true });

  const familyId = me.family.id;
  const range = historyRange(date, today);
  const checkIns = useCheckIns(familyId, range.from, range.to);
  const writes = useCheckInWrites(familyId);
  const history = createHistory(me.members, checkIns.data ?? []);
  const day = history.day(date);
  const gaps = day.members.filter((m) => m.status.kind === "gap");
  const dismissedGaps = useDismissedGapProposals();
  const gapProposals =
    date === today && !checkIns.isPending ? history.gapProposals(today).filter((p) => !dismissedGaps.isDismissed(p)) : [];
  // What the latest gap fill wrote and skipped, shown once the card is gone.
  const [gapFillNotice, setGapFillNotice] = useState<string | null>(null);
  // The days open in the editor sheet, one at a time, if any.
  const [editing, setEditing] = useState<{ steps: SheetStep[]; index: number } | null>(null);
  const step = editing?.steps[editing.index];
  const edit = (...steps: SheetStep[]) => setEditing({ steps, index: 0 });
  const nextStep = () =>
    setEditing((current) => (current && current.index + 1 < current.steps.length ? { ...current, index: current.index + 1 } : null));

  return (
    <section className="screen">
      <h1>{t.today.greeting(me.user.name)}</h1>
      <p className="muted">{me.family.name}</p>

      <DateBar date={date} today={today} onChange={setDate} />

      {day.total === 0 ? (
        <NoMembersNotice />
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
          {!checkIns.isPending && range.to === today && <FamilyStreakLine history={history} today={today} />}
          {gapFillNotice && date === today && (
            <p className="notice" role="status">
              {gapFillNotice}
            </p>
          )}
          {gapProposals.map((proposal) => (
            <GapFillCard
              key={proposal.from}
              proposal={proposal}
              busy={writes.busy}
              onFill={(fills) => {
                setGapFillNotice(null);
                writes.fill(fills, {
                  onSuccess: ({ written, skipped }) => setGapFillNotice(t.gapFill.result(written.length, skipped.length)),
                });
              }}
              onOneByOne={() =>
                edit(...missedDays(proposal).map(({ member, date: missed }) => ({ member, date: missed, startAs: "healthy" as const })))
              }
              onDismiss={() => dismissedGaps.dismiss(proposal)}
            />
          ))}

          <ul className="day-cards">
            {day.members.map(({ member, status }) => (
              <MemberDayCard
                key={`${date}|${member.id}`}
                member={member}
                status={checkIns.isPending ? null : status}
                isToday={date === today}
                yesterday={history.statusOf(member.id, addDays(date, -1))}
                bugDay={history.bugOn(member.id, date)}
                shortcuts={status.kind === "gap" ? shortcutsAfterSickDay(history, member.id, date) : []}
                busy={writes.busy}
                onHealthy={() => writes.save({ date, memberId: member.id, state: { status: "healthy" } })}
                onShortcut={(state) => writes.save({ date, memberId: member.id, state })}
                onSick={() => edit({ member, date, startAs: "sick" })}
                onEdit={() => edit({ member, date, startAs: "healthy" })}
              />
            ))}
          </ul>
        </>
      )}
      {editing && step && (
        <CheckInSheet
          key={`${step.date}|${step.member.id}`}
          title={t.joined([
            t.sheet.title(step.member.name, dayLabel(step.date, today)),
            ...(editing.steps.length > 1 ? [t.sheet.step(editing.index + 1, editing.steps.length)] : []),
          ])}
          checkIn={checkIns.data?.find((c) => c.memberId === step.member.id && c.date === step.date) ?? null}
          startAs={step.startAs}
          continuesBug={history.continuesBug(step.member.id, step.date)}
          busy={writes.busy}
          onSave={(state, done) =>
            writes.save({ date: step.date, memberId: step.member.id, state }, { ...done, onSuccess: nextStep })
          }
          onDelete={(done) => writes.remove({ date: step.date, memberId: step.member.id }, { ...done, onSuccess: nextStep })}
          onSkip={editing.steps.length > 1 ? nextStep : undefined}
          onClose={() => setEditing(null)}
        />
      )}
      {(writes.failed || checkIns.isError) && <p className="notice">{t.offlineOrError}</p>}
    </section>
  );
}

/** Besser, Gleich and Schlechter for a Gap after a Sick day; none otherwise. */
function shortcutsAfterSickDay(history: History, memberId: string, date: string): ShortcutOffer[] {
  return AFTER_SICK_DAY.flatMap((shortcut) => {
    const state = history.shortcut(shortcut, memberId, date);
    return state ? [{ shortcut, state }] : [];
  });
}

/**
 * Recent days share one range ending today, so moving between them needs no refetch. It also
 * covers the date's whole Season (and a little before), for its Bugs' numbers; when that's
 * more than one request can hold, the range ends with that Season instead of today.
 */
function historyRange(date: string, today: string): { from: string; to: string } {
  const season = seasonOf(date);
  const seasonFrom = addDays(season.start, -BUG_LOOKBACK_DAYS);
  let to = date > addDays(today, -RECENT_DAYS) ? today : date;
  if (daysBetweenInclusive(seasonFrom, to) > MAX_RANGE_DAYS) to = season.end < today ? season.end : today;
  const streaksFrom = addDays(to, -(HISTORY_DAYS - 1));
  return { from: streaksFrom < seasonFrom ? streaksFrom : seasonFrom, to };
}

/** "Alle fit seit 3. Nov. (13 Tage) · Letzte Fit-Strähne: 9 Tage", as far as there is any. */
function FamilyStreakLine({ history, today }: { history: History; today: string }) {
  const { current, previous } = history.familyStreaks(today);
  const parts = [
    current && t.today.familyStreak(shortDate(current.from), current.days),
    previous && t.today.previousFamilyStreak(previous.days),
  ].filter((part) => part !== null);
  return parts.length > 0 ? <p className="family-streak">{t.joined(parts)}</p> : null;
}

function MemberDayCard({
  member,
  status,
  isToday,
  yesterday,
  bugDay,
  shortcuts,
  busy,
  onHealthy,
  onShortcut,
  onSick,
  onEdit,
}: {
  member: Member;
  /** null while loading. */
  status: DayStatus | null;
  isToday: boolean;
  /** The day before the selected date. */
  yesterday: DayStatus;
  /** The Bug a Sick day belongs to ("Infekt #3 · Tag 4"); null on other days. */
  bugDay: BugDay | null;
  shortcuts: ShortcutOffer[];
  busy: boolean;
  onHealthy: () => void;
  onShortcut: (state: CheckInState) => void;
  onSick: () => void;
  onEdit: () => void;
}) {
  const healthyButton = (
    <button
      type="button"
      className="button primary small"
      aria-label={t.today.markHealthyLabel(member.name)}
      disabled={busy}
      onClick={onHealthy}
    >
      {t.today.markHealthy}
    </button>
  );

  return (
    <li className="day-card" data-status={status?.kind ?? "loading"} aria-label={member.name}>
      <MemberAvatar member={member} />
      <div className="day-card-main">
        <span className="member-name">{member.name}</span>
        <span className="day-card-status">
          {status ? t.joined([statusText(status), ...(bugDay ? [t.today.bugDay(bugDay.bug.number, bugDay.day)] : [])]) : t.loading}
        </span>
        {shortcuts.length > 0 && yesterday.kind === "sick" && (
          <span className="day-card-status">{t.today.previousDaySick(isToday, t.severityIcon[yesterday.severity], t.severity[yesterday.severity])}</span>
        )}
        {status?.kind === "sick" && status.symptoms.length > 0 && (
          <span className="day-card-badges">
            {inCatalogOrder(status.symptoms)
              .map(symptom)
              .map(({ key, name, badge }) => (
                <span key={key} role="img" aria-label={name} title={name}>
                  {badge}
                </span>
              ))}
          </span>
        )}
      </div>
      {status?.kind === "gap" && shortcuts.length > 0 && (
        <>
          <button
            type="button"
            className="icon-button"
            aria-label={t.today.markSickLabel(member.name)}
            title={t.today.markSickLabel(member.name)}
            disabled={busy}
            onClick={onSick}
          >
            ✏️
          </button>
          <div className="day-card-actions shortcuts">
            {shortcuts.map(({ shortcut, state }) => (
              <button
                key={shortcut}
                type="button"
                className="button small"
                aria-label={t.today.shortcutLabel(member.name, t.today.shortcut[shortcut])}
                disabled={busy}
                onClick={() => onShortcut(state)}
              >
                {t.today.shortcut[shortcut]}
              </button>
            ))}
            {healthyButton}
          </div>
        </>
      )}
      {status?.kind === "gap" && shortcuts.length === 0 && (
        <div className="day-card-actions">
          {healthyButton}
          <button
            type="button"
            className="button small"
            aria-label={t.today.markSickLabel(member.name)}
            disabled={busy}
            onClick={onSick}
          >
            {t.today.markSick}
          </button>
        </div>
      )}
      {status && status.kind !== "gap" && (
        <button
          type="button"
          className="icon-button"
          aria-label={t.today.edit(member.name)}
          title={t.today.edit(member.name)}
          onClick={onEdit}
        >
          ✏️
        </button>
      )}
    </li>
  );
}

function statusText(status: DayStatus): string {
  if (status.kind === "gap") return t.today.gap;
  if (status.kind === "healthy") return t.today.healthy;
  return t.today.sick(t.severityIcon[status.severity], t.severity[status.severity]);
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

