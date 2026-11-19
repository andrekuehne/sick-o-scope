import { type CSSProperties, type RefObject, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Me } from "../../shared/auth.ts";
import type { Severity } from "../../shared/check-ins.ts";
import { addDays, datesBetween, daysBetweenInclusive, isMonday } from "../../shared/dates.ts";
import { createHistory, type DayStatus, type FamilyWave, type History, type Season, seasonOf } from "../../shared/history.ts";
import type { Member } from "../../shared/members.ts";
import { type Medication, medication, medicationsInCatalogOrder } from "../../shared/medications.ts";
import { type Symptom, symptom, symptomsInCatalogOrder } from "../../shared/symptoms.ts";
import { BUG_LOOKBACK_DAYS, useCheckIns, useCheckInWrites } from "../check-ins.ts";
import { CheckInSheet } from "../components/CheckInSheet.tsx";
import { SeasonBar } from "../components/SeasonBar.tsx";
import { MemberAvatarLink } from "../components/MemberAvatarLink.tsx";
import { NoMembersNotice } from "../components/NoMembersNotice.tsx";
import { dayLabel, monthLabel, shortDateRange, useLocalToday } from "../dates.ts";
import { useSeasonChoice } from "../season-choice.ts";
import { t } from "../strings.ts";

/**
 * The zoom steps, as pixels per day. Everything is drawn from one continuous scale
 * (`pxPerDay`), so pinch-zoom can later set any value in between.
 */
const ZOOM_STEPS = { day: 44, week: 14, month: 4 } as const;
type ZoomStep = keyof typeof ZOOM_STEPS;
/** From this scale on there's room for single days: one tap target each, with Badges. */
const DAY_DETAIL_PX = 30;
/** From this scale on, Mondays get their day number on the axis. */
const WEEK_DETAIL_PX = 10;
/** Symptom Badges that fit on one day; with more, the last place says "+N". */
const MAX_BADGES = 4;
/** The same for the smaller row of Medication Badges below. */
const MAX_MEDICATION_BADGES = 3;

/** Which days to draw: the ones on screen and a screen's width either side (indexes into the dates). */
type DrawnDays = { first: number; last: number };

/** A day's colour in a lane, and what it means. An archived Member's days without a Check-in stay blank. */
const DAY_COLOURS = {
  healthy: t.timeline.healthy,
  "sick-0": t.severity[0],
  "sick-1": t.severity[1],
  "sick-2": t.severity[2],
  "sick-3": t.severity[3],
  "sick-4": t.severity[4],
  "sick-5": t.severity[5],
  gap: t.timeline.gap,
} as const satisfies Record<"healthy" | `sick-${Severity}` | "gap", string>;
type DayColour = keyof typeof DAY_COLOURS | "blank";

/**
 * The timeline ("Verlauf"): one lane per Member, time running left to right, a Season at a
 * time. It opens on the current Season, scrolled to today; tapping a day opens the editor sheet.
 */
export function TimelineScreen({ me }: { me: Me }) {
  const today = useLocalToday();
  const currentSeason = seasonOf(today);
  const [season, setSeason] = useSeasonChoice(today);
  const to = season.end < today ? season.end : today;
  const [zoom, setZoom] = useState<ZoomStep>("week");
  const pxPerDay = ZOOM_STEPS[zoom];

  // The whole Season in one request, and the days just before it for a Bug running into it.
  const checkIns = useCheckIns(me.family.id, addDays(season.start, -BUG_LOOKBACK_DAYS), to);
  const writes = useCheckInWrites(me.family.id);
  const history = useMemo(() => createHistory(me.members, checkIns.data ?? []), [me.members, checkIns.data]);
  const dates = useMemo(() => datesBetween(season.start, to), [season.start, to]);
  const waves = useMemo(() => wavesShown(history, season), [history, season]);
  // Archived Members only for the days they have Check-ins.
  const lanes = me.members.filter(
    (m) => !m.archived || checkIns.data?.some((c) => c.memberId === m.id && c.date >= season.start),
  );
  const [editing, setEditing] = useState<{ member: Member; date: string } | null>(null);
  const screen = useRef<HTMLElement>(null);
  const timeline = useRef<HTMLDivElement>(null);
  const axisSpacer = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const laneRefs = useMemo(() => ({ screen, timeline, axisSpacer, scroller }), []);
  const laneShare = useLaneShare(laneRefs, lanes.length);
  const [viewport, measure] = useViewport(scroller);
  const drawn = drawnDays(viewport, pxPerDay, dates.length);
  // What stays in view when the zoom changes: the right edge (today) if that's where we
  // were, otherwise the day at the middle of the screen.
  const zoomAnchor = useRef<"end" | number | null>(null);
  useLayoutEffect(() => {
    // Open at the right edge: today, or the Season's last day.
    if (scroller.current) scroller.current.scrollLeft = scroller.current.scrollWidth;
    measure();
  }, [season.start, checkIns.isPending, measure]);
  useLayoutEffect(() => {
    const element = scroller.current;
    if (!element || zoomAnchor.current === null) return;
    element.scrollLeft =
      zoomAnchor.current === "end" ? element.scrollWidth : zoomAnchor.current * pxPerDay - element.clientWidth / 2;
    zoomAnchor.current = null;
    measure();
  }, [pxPerDay, measure]);
  // Zoomed all the way out, a fingertip covers days: a tap zooms in there instead.
  const zoomInOn = (date: string) => {
    zoomAnchor.current = dates.indexOf(date) + 0.5;
    setZoom("day");
  };
  const zoomTo = (step: ZoomStep) => {
    const element = scroller.current;
    if (element) {
      const atEnd = element.scrollLeft + element.clientWidth >= element.scrollWidth - pxPerDay;
      zoomAnchor.current = atEnd ? "end" : (element.scrollLeft + element.clientWidth / 2) / pxPerDay;
    }
    setZoom(step);
  };

  return (
    <section className="screen" ref={screen}>
      <h1>{t.timeline.title}</h1>

      <SeasonBar
        season={season}
        previous={seasonOf(addDays(season.start, -1))}
        next={season.start < currentSeason.start ? seasonOf(addDays(season.end, 1)) : null}
        onChange={setSeason}
      />

      <div className="zoom-steps" role="group" aria-label={t.timeline.zoom}>
        {(Object.keys(ZOOM_STEPS) as ZoomStep[]).map((step) => (
          <button key={step} type="button" className="zoom-step" aria-pressed={zoom === step} onClick={() => zoomTo(step)}>
            {t.timeline.zoomSteps[step]}
          </button>
        ))}
      </div>

      {lanes.length === 0 ? (
        <NoMembersNotice />
      ) : checkIns.isPending ? (
        <p className="muted">{t.loading}</p>
      ) : (
        <>
          {checkIns.data?.length === 0 && <p className="muted">{t.timeline.empty}</p>}
          <div
            ref={timeline}
            className="timeline"
            data-detail={pxPerDay >= DAY_DETAIL_PX}
            data-waves={waves.length > 0}
            style={laneShare === null ? undefined : ({ "--lane-share": `${laneShare}px` } as CSSProperties)}
          >
            <div className="timeline-names">
              <div ref={axisSpacer} className="timeline-axis-spacer" />
              {lanes.map((member) => (
                <div key={member.id} className="timeline-name">
                  <MemberAvatarLink member={member} season={season} />
                </div>
              ))}
            </div>
            <div className="timeline-scroller" ref={scroller} onScroll={measure}>
              <div className="timeline-canvas" style={{ width: dates.length * pxPerDay }}>
                <Axis dates={dates} drawn={drawn} pxPerDay={pxPerDay} />
                <WaveBands waves={waves} dates={dates} pxPerDay={pxPerDay} />
                {lanes.map((member) => (
                  <Lane
                    key={member.id}
                    member={member}
                    dates={dates}
                    drawn={drawn}
                    history={history}
                    pxPerDay={pxPerDay}
                    today={today}
                    onOpen={(date) => (pxPerDay >= WEEK_DETAIL_PX ? setEditing({ member, date }) : zoomInOn(date))}
                  />
                ))}
              </div>
            </div>
          </div>
          <ul className="timeline-legend" aria-label={t.timeline.legend}>
            {Object.entries(DAY_COLOURS).map(([colour, meaning]) => (
              <li key={colour}>
                <span className="legend-swatch" data-colour={colour} aria-hidden="true" />
                {meaning}
              </li>
            ))}
          </ul>
        </>
      )}

      {editing && (
        <CheckInSheet
          key={`${editing.date}|${editing.member.id}`}
          title={t.sheet.title(editing.member.name, dayLabel(editing.date, today))}
          checkIn={checkIns.data?.find((c) => c.memberId === editing.member.id && c.date === editing.date) ?? null}
          startAs="healthy"
          continuesBug={history.continuesBug(editing.member.id, editing.date)}
          busy={writes.busy}
          onSave={(state, done) => writes.save({ date: editing.date, memberId: editing.member.id, state }, done)}
          onDelete={(done) => writes.remove({ date: editing.date, memberId: editing.member.id }, done)}
          onClose={() => setEditing(null)}
        />
      )}
      {(writes.failed || checkIns.isError) && <p className="notice">{t.offlineOrError}</p>}
    </section>
  );
}

/** Months on top; below, every day number (Tag) or Mondays' (Woche). */
function Axis({ dates, drawn, pxPerDay }: { dates: string[]; drawn: DrawnDays; pxPerDay: number }) {
  const months = blocksOf(dates, (date) => date.slice(0, 7));
  const numbered = pxPerDay < WEEK_DETAIL_PX ? [] : indexes(drawn).filter((i) => pxPerDay >= DAY_DETAIL_PX || isMonday(dates[i]!));
  return (
    <div className="timeline-axis" aria-hidden="true">
      <div className="timeline-months">
        {months.map(({ from, start, days }, i) => (
          <span key={from} style={place(start, days, pxPerDay)}>
            <span className="timeline-month-label">{monthLabel(from, i === 0 || from.slice(5, 7) === "01")}</span>
          </span>
        ))}
      </div>
      <div className="timeline-day-numbers">
        {numbered.map((i) => (
          <span key={i} style={place(i, 1, pxPerDay)}>
            {Number(dates[i]!.slice(8))}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * The Family waves over the Season's days, each with its label: those started in it ("Welle N"),
 * and one from last Season still running on 1 Sep. That one goes without its number, which
 * would need all of last Season's Check-ins; only the days just before this Season are loaded.
 */
function wavesShown(history: History, season: Season): { wave: FamilyWave; label: string }[] {
  const last = seasonOf(addDays(season.start, -1));
  return [
    ...history
      .waves(last)
      .filter((wave) => wave.to >= season.start)
      .map((wave) => ({ wave, label: t.timeline.earlierWave(last.label) })),
    ...history.waves(season).map((wave) => ({ wave, label: t.timeline.wave(wave.number) })),
  ];
}

/** A band across all lanes over each Family wave's days, cut to the days shown. */
function WaveBands({ waves, dates, pxPerDay }: { waves: { wave: FamilyWave; label: string }[]; dates: string[]; pxPerDay: number }) {
  const first = dates[0]!;
  const last = dates.at(-1)!;
  return waves.map(({ wave, label }) => {
    const from = wave.from > first ? wave.from : first;
    const to = wave.to < last ? wave.to : last;
    if (from > to) return null;
    return (
      <div key={wave.from} className="timeline-wave" style={place(dates.indexOf(from), daysBetweenInclusive(from, to), pxPerDay)}>
        <span className="timeline-wave-label">{label}</span>
      </div>
    );
  });
}

/**
 * One Member's lane. Zoomed in, every day is its own button with its Badges; zoomed out,
 * days of the same colour merge into one block, and a tap finds the day under the finger.
 */
function Lane({
  member,
  dates,
  drawn,
  history,
  pxPerDay,
  today,
  onOpen,
}: {
  member: Member;
  dates: string[];
  drawn: DrawnDays;
  history: History;
  pxPerDay: number;
  today: string;
  onOpen: (date: string) => void;
}) {
  const statusOn = (date: string) => history.statusOf(member.id, date);
  // Recomputed only when the data changes, not on every scroll step.
  const blocks = useMemo(
    () => blocksOf(dates, (date) => colourOf(member, history.statusOf(member.id, date))),
    [dates, history, member],
  );

  if (pxPerDay >= DAY_DETAIL_PX) {
    return (
      <div className="timeline-lane" role="group" aria-label={member.name}>
        {indexes(drawn).map((i) => {
          const date = dates[i]!;
          const status = statusOn(date);
          const colour = colourOf(member, status);
          if (colour === "blank") return null;
          const symptoms = status.kind === "sick" ? symptomsInCatalogOrder(status.symptoms).map(symptom) : [];
          const medications = status.kind === "sick" ? medicationsInCatalogOrder(status.medications).map(medication) : [];
          const label = t.timeline.days(member.name, dayLabel(date, today), dayText(DAY_COLOURS[colour], symptoms, medications));
          return (
            <button
              key={date}
              type="button"
              className="timeline-day"
              data-colour={colour}
              data-today={date === today}
              style={place(i, 1, pxPerDay)}
              aria-label={label}
              title={label}
              onClick={() => onOpen(date)}
            >
              {symptoms.length > 0 && (
                <span className="timeline-badges" aria-hidden="true">
                  {badgesUpTo(symptoms, MAX_BADGES)}
                </span>
              )}
              {medications.length > 0 && (
                <span className="timeline-medication-badges" aria-hidden="true">
                  {badgesUpTo(medications, MAX_MEDICATION_BADGES)}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="timeline-lane" role="group" aria-label={member.name}>
      {blocks.map(({ key: colour, from, to, start, days }) => {
        if (colour === "blank" || start > drawn.last || start + days - 1 < drawn.first) return null;
        const label = t.timeline.days(member.name, shortDateRange(from, to), DAY_COLOURS[colour]);
        return (
          <button
            key={from}
            type="button"
            className="timeline-block"
            data-colour={colour}
            style={place(start, days, pxPerDay)}
            aria-label={label}
            title={label}
            onClick={(event) => {
              const x = event.clientX - event.currentTarget.getBoundingClientRect().left;
              onOpen(addDays(from, Math.min(days - 1, Math.max(0, Math.floor(x / pxPerDay)))));
            }}
          />
        );
      })}
    </div>
  );
}

/** A day's colour meaning, then its Symptoms and the Medications taken: "Richtig krank (Husten), mit Ibuprofen". */
function dayText(meaning: string, symptoms: Symptom[], medications: Medication[]): string {
  const withSymptoms = symptoms.length > 0 ? t.timeline.withSymptoms(meaning, symptoms.map((s) => s.name)) : meaning;
  return medications.length > 0 ? t.timeline.withMedications(withSymptoms, medications.map((m) => m.name)) : withSymptoms;
}

/** The Badges in a row with room for `max`; with more, the last place says "+N". */
function badgesUpTo(items: { badge: string }[], max: number): string {
  if (items.length <= max) return items.map((item) => item.badge).join("");
  return [...items.slice(0, max - 1).map((item) => item.badge), t.timeline.moreBadges(items.length - max + 1)].join("");
}

function colourOf(member: Member, status: DayStatus): DayColour {
  if (status.kind === "gap") return member.archived ? "blank" : "gap";
  return status.kind === "healthy" ? "healthy" : `sick-${status.severity}`;
}

/** Consecutive dates with the same key, as blocks; `start` is the index of the first one. */
function blocksOf<Key extends string>(dates: string[], keyOf: (date: string) => Key) {
  const blocks: { key: Key; from: string; to: string; start: number; days: number }[] = [];
  dates.forEach((date, i) => {
    const key = keyOf(date);
    const last = blocks.at(-1);
    if (last && last.key === key) {
      last.to = date;
      last.days += 1;
    } else {
      blocks.push({ key, from: date, to: date, start: i, days: 1 });
    }
  });
  return blocks;
}

/** Where `days` days starting at index `start` go on the scale. */
function place(start: number, days: number, pxPerDay: number) {
  return { left: start * pxPerDay, width: days * pxPerDay };
}

/** What the lane height is measured from: the screen, and the timeline's parts. */
type LaneRefs = Record<"screen" | "timeline" | "axisSpacer" | "scroller", RefObject<HTMLElement | null>>;

/**
 * Each of `count` lanes' share of the window, gap included: what's left below the axis once
 * the legend, the scroller's own scrollbar (on desktops) and the space the screen's container
 * keeps free at the bottom (for the navigation) are taken off. The stylesheet turns it into a
 * lane height between a compact minimum and a maximum. It doesn't depend on the lanes' current
 * height, so measuring again after they resize settles at once.
 */
/** `refs` must stay the same object across renders. */
function useLaneShare(refs: LaneRefs, count: number): number | null {
  const [share, setShare] = useState<number | null>(null);
  const measure = useCallback(() => {
    const [section, timeline, axisSpacer, scroller] = [refs.screen, refs.timeline, refs.axisSpacer, refs.scroller].map((ref) => ref.current);
    const container = section?.parentElement;
    if (!section || !container || !timeline || !axisSpacer || !scroller || count === 0) return;
    const lanesTop = axisSpacer.getBoundingClientRect().bottom + window.scrollY;
    const scrollbar = scroller.offsetHeight - scroller.clientHeight;
    const below =
      section.getBoundingClientRect().bottom - timeline.getBoundingClientRect().bottom + parseFloat(getComputedStyle(container).paddingBottom);
    setShare(Math.floor((window.innerHeight - lanesTop - scrollbar - below) / count));
  }, [refs, count]);

  // After every render, before it's painted: the timeline appearing after loading, another
  // Season, the waves' row. An unchanged result doesn't render again.
  useLayoutEffect(measure);
  // And whatever moves the timeline without a render here: the window, a notice or the offline
  // banner (outside the screen, so the container or the page changes size instead).
  useEffect(() => {
    const observer = new ResizeObserver(measure);
    for (const element of [refs.screen.current, refs.screen.current?.parentElement, document.body]) {
      if (element) observer.observe(element);
    }
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [refs, measure]);
  return share;
}

/** The visible part of the scroller, plus a screen's width either side, in pixels. */
type Viewport = { from: number; to: number };

/**
 * Tracks what's worth drawing as the timeline scrolls. It moves in steps of a screen's
 * width, so scrolling only re-renders when a new screenful comes near.
 */
function useViewport(scroller: RefObject<HTMLDivElement | null>) {
  const [viewport, setViewport] = useState<Viewport | null>(null);
  const measure = useCallback(() => {
    const element = scroller.current;
    if (!element) return;
    const width = Math.max(element.clientWidth, 1);
    const screen = Math.floor(element.scrollLeft / width);
    const from = (screen - 1) * width;
    const to = (screen + 2) * width;
    setViewport((current) => (current?.from === from && current.to === to ? current : { from, to }));
  }, [scroller]);
  useEffect(() => {
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);
  return [viewport, measure] as const;
}

function drawnDays(viewport: Viewport | null, pxPerDay: number, count: number): DrawnDays {
  if (!viewport) return { first: 0, last: -1 };
  return {
    first: Math.max(0, Math.floor(viewport.from / pxPerDay)),
    last: Math.min(count - 1, Math.ceil(viewport.to / pxPerDay)),
  };
}

function indexes({ first, last }: DrawnDays): number[] {
  return Array.from({ length: Math.max(0, last - first + 1) }, (_, k) => first + k);
}
