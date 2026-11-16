import { useEffect, useMemo, useState } from "react";
import type { Me } from "../../shared/auth.ts";
import {
  createHistory,
  HEALTHY_MILESTONES,
  LOGGING_MILESTONES,
  milestoneJustReached,
  type Streak,
} from "../../shared/history.ts";
import { type Celebration, useCelebrations } from "../celebrations.ts";
import { useAllCheckIns } from "../check-ins.ts";
import { t } from "../strings.ts";

/**
 * Today's Logging Streak ("📋 Lückenlos seit 23 Tagen"), and little celebrations: a Milestone
 * of the everyone-Healthy Streak or the Logging Streak, or a new best everyone-Healthy Streak.
 * Each celebration shows once per Device, with confetti. Best Streaks need every Check-in, so
 * this works from all of them (loaded in the background), not just the cards' year.
 */
export function Milestones({ me, today }: { me: Me; today: string }) {
  const checkIns = useAllCheckIns(me.family.id);
  const history = useMemo(() => createHistory(me.members, checkIns.data ?? []), [me.members, checkIns.data]);
  const logging = useMemo(() => history.loggingStreak(today), [history, today]);

  const due = useMemo(() => {
    if (!checkIns.data) return [];
    const { current } = history.familyStreaks(today);
    return [
      ...milestone("family", current, HEALTHY_MILESTONES, t.milestones.family),
      // Keyed by the Streak alone: it goes on beating the best every day, but that's news once.
      ...(current && history.beatsBestFamilyStreak(today) ? [{ key: `best|${current.from}`, text: t.milestones.newBest }] : []),
      ...milestone("logging", logging, LOGGING_MILESTONES, t.milestones.logging),
    ];
  }, [checkIns.data, history, today, logging]);
  const showing = useCelebrations(due);

  return (
    <>
      {logging && <p className="family-streak">{t.milestones.loggingStreak(logging.days)}</p>}
      {showing.map((celebration) => (
        <p key={celebration.key} className="celebration" role="status">
          {celebration.text}
        </p>
      ))}
      {/* A new key starts a new shower for a celebration that comes later. */}
      {showing.length > 0 && <Confetti key={showing.map((c) => c.key).join(" ")} />}
    </>
  );
}

/** The Streak's Milestone just reached, if any, as a celebration keyed by the Streak's first day. */
function milestone(
  kind: string,
  streak: Streak | null,
  milestones: readonly number[],
  text: (days: number) => string,
): Celebration[] {
  const days = milestoneJustReached(streak, milestones);
  return streak && days ? [{ key: `${kind}|${streak.from}|${days}`, text: text(days) }] : [];
}

const PIECES = ["🎉", "🎊", "✨", "🌞", "💪"];
/** Long enough for the slowest piece: the fall (2.6 s in styles.css) after the longest delay (0.8 s). */
const SHOWER_MS = 3500;

/** A short shower of emoji, gone after a few seconds; none at all with reduced motion (CSS). */
function Confetti() {
  const [falling, setFalling] = useState(true);
  const pieces = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => ({
        emoji: PIECES[i % PIECES.length],
        left: Math.random() * 100,
        delay: Math.random() * 0.8,
      })),
    [],
  );
  useEffect(() => {
    const timer = setTimeout(() => setFalling(false), SHOWER_MS);
    return () => clearTimeout(timer);
  }, []);
  if (!falling) return null;
  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((piece, i) => (
        <span key={i} style={{ left: `${piece.left}%`, animationDelay: `${piece.delay}s` }}>
          {piece.emoji}
        </span>
      ))}
    </div>
  );
}
