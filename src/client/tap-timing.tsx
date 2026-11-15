// TEMPORARY [DEBUG-messen]: measures tap latency on a real phone, to find out why switching
// screens with the bottom bar feels delayed. Switched on by opening the app once with
// ?messen=1 (it's remembered in this browser, so the installed app shows it too) and off
// with ?messen=0. Remove this file and its use in App.tsx once the cause is known.
// Debug-only text, so it isn't in strings.ts.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocation } from "react-router";

const FLAG = "sick-o-scope:messen";
const REPLACE_FLAG = "sick-o-scope:messen-ersetzen";

/**
 * Experiment: with ?ersetzen=1 (off with ?ersetzen=0), the bottom bar replaces the history
 * entry instead of adding one, to test whether Chrome's per-navigation work causes the delay.
 */
export const replaceTabHistory: boolean = (() => {
  try {
    const param = new URLSearchParams(window.location.search).get("ersetzen");
    if (param === "1") localStorage.setItem(REPLACE_FLAG, "1");
    if (param === "0") localStorage.removeItem(REPLACE_FLAG);
    return localStorage.getItem(REPLACE_FLAG) === "1";
  } catch {
    return false;
  }
})();

/** Reads ?messen=1 / ?messen=0 once at startup, and whether measuring is on. */
export function tapTimingEnabled(): boolean {
  try {
    const param = new URLSearchParams(window.location.search).get("messen");
    if (param === "1") localStorage.setItem(FLAG, "1");
    if (param === "0") localStorage.removeItem(FLAG);
    return localStorage.getItem(FLAG) === "1";
  } catch {
    return false;
  }
}

type Tap = {
  id: number;
  target: string;
  /** The finger touched down, as the OS reported it (event.timeStamp); everything below is ms after that. */
  down: number;
  arrived: number;
  up?: number;
  click?: number;
  screenChanged?: number;
  painted?: number;
  /** Chrome's own measure: until the frame after the touch was actually shown on the display. */
  shown?: number;
  longTasks: number[];
};

let nextId = 0;

export function TapTiming() {
  const [taps, setTaps] = useState<Tap[]>([]);
  const current = useRef<Tap | null>(null);
  const location = useLocation();

  useEffect(() => {
    // One row per tap, updated in place as its numbers come in.
    const update = (tap: Tap) =>
      setTaps((list) => [{ ...tap }, ...list.filter((t) => t.id !== tap.id)].sort((a, b) => b.id - a.id).slice(0, 6));
    const label = (target: EventTarget | null) => {
      const el = (target as Element | null)?.closest("a, button, label, input");
      return (el?.getAttribute("aria-label") || el?.textContent || el?.tagName || "?").trim().slice(0, 16);
    };
    const onDown = (e: PointerEvent) => {
      const tap: Tap = { id: nextId++, target: label(e.target), down: e.timeStamp, arrived: Math.round(performance.now() - e.timeStamp), longTasks: [] };
      current.current = tap;
      update(tap);
    };
    const onUp = (e: PointerEvent) => {
      const tap = current.current;
      if (tap) update(Object.assign(tap, { up: Math.round(e.timeStamp - tap.down) }));
    };
    const onClick = () => {
      const tap = current.current;
      if (tap) update(Object.assign(tap, { click: Math.round(performance.now() - tap.down) }));
    };
    document.addEventListener("pointerdown", onDown, { capture: true });
    document.addEventListener("pointerup", onUp, { capture: true });
    document.addEventListener("click", onClick, { capture: true });

    const observers: PerformanceObserver[] = [];
    try {
      const events = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const tap = current.current;
          if (entry.name === "pointerdown" && tap && Math.abs(entry.startTime - tap.down) < 2) {
            update(Object.assign(tap, { shown: Math.round(entry.duration) }));
          }
        }
      });
      events.observe({ type: "event", durationThreshold: 16, buffered: false } as PerformanceObserverInit);
      observers.push(events);
    } catch {
      // No event timing in this browser.
    }
    try {
      const longTasks = new PerformanceObserver((list) => {
        const tap = current.current;
        if (!tap) return;
        for (const entry of list.getEntries()) {
          if (entry.startTime + entry.duration >= tap.down - 200) tap.longTasks.push(Math.round(entry.duration));
        }
        update(tap);
      });
      longTasks.observe({ type: "longtask" });
      observers.push(longTasks);
    } catch {
      // No long task timing in this browser.
    }
    return () => {
      document.removeEventListener("pointerdown", onDown, { capture: true });
      document.removeEventListener("pointerup", onUp, { capture: true });
      document.removeEventListener("click", onClick, { capture: true });
      for (const observer of observers) observer.disconnect();
    };
  }, []);

  // A new screen: when React committed it, and when the frame after it was handed over.
  useLayoutEffect(() => {
    const tap = current.current;
    if (!tap) return;
    tap.screenChanged = Math.round(performance.now() - tap.down);
    requestAnimationFrame(() =>
      setTimeout(() => {
        tap.painted = Math.round(performance.now() - tap.down);
        setTaps((list) => [{ ...tap }, ...list.filter((t) => t.id !== tap.id)].sort((a, b) => b.id - a.id).slice(0, 6));
      }, 0),
    );
  }, [location.pathname, location.search]);

  return (
    <div className="tap-timing" aria-hidden="true">
      <div>
        Modus: {replaceTabHistory ? "ERSETZEN" : "normal"} · ms nach Fingerkontakt: ↓ angekommen · B Bildschirm · G übergeben · S
        sichtbar (Chrome) · ↑ los · K Klick · L lang
      </div>
      {taps.map((tap) => (
        <div key={tap.id}>
          {tap.target}: ↓{tap.arrived} · B{tap.screenChanged ?? "–"} · G{tap.painted ?? "–"} · S{tap.shown ?? "<16"} · ↑
          {tap.up ?? "–"} · K{tap.click ?? "–"} · L[{tap.longTasks.join(",")}]
        </div>
      ))}
    </div>
  );
}
