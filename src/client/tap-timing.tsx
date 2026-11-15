// TEMPORARY [DEBUG-messen]: measures tap latency on a real phone, to find out why switching
// screens with the bottom bar feels delayed. Switched on by opening the app once with
// ?messen=1 (it's remembered in this browser, so the installed app shows it too) and off
// with ?messen=0. Remove this file and its use in App.tsx once the cause is known.
// Debug-only text, so it isn't in strings.ts.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocation } from "react-router";

const FLAG = "sick-o-scope:messen";

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
  target: string;
  /** All in ms after the finger touched down, as the OS reported it (event.timeStamp). */
  downHandled: number;
  up?: number;
  clickHandled?: number;
  screenChanged?: number;
  painted?: number;
  /** Main-thread tasks over 50 ms during the tap, in ms. */
  longTasks: number[];
};

export function TapTiming() {
  const [taps, setTaps] = useState<Tap[]>([]);
  const current = useRef<{ down: number; tap: Tap } | null>(null);
  const location = useLocation();

  useEffect(() => {
    const update = () => {
      const c = current.current;
      if (c) setTaps((list) => [{ ...c.tap }, ...list.filter((t) => t !== c.tap)].slice(0, 6));
    };
    const label = (target: EventTarget | null) => {
      const el = (target as Element | null)?.closest("a, button, label, input");
      return (el?.getAttribute("aria-label") || el?.textContent || el?.tagName || "?").trim().slice(0, 18);
    };
    const onDown = (e: PointerEvent) => {
      const tap: Tap = { target: label(e.target), downHandled: Math.round(performance.now() - e.timeStamp), longTasks: [] };
      current.current = { down: e.timeStamp, tap };
      update();
    };
    const since = (e: Event) => Math.round(e.timeStamp - (current.current?.down ?? e.timeStamp));
    const onUp = (e: PointerEvent) => {
      if (current.current) current.current.tap.up = since(e);
      update();
    };
    const onClick = (e: MouseEvent) => {
      if (current.current) current.current.tap.clickHandled = Math.round(performance.now() - current.current.down);
      void e;
      update();
    };
    document.addEventListener("pointerdown", onDown, { capture: true });
    document.addEventListener("pointerup", onUp, { capture: true });
    document.addEventListener("click", onClick, { capture: true });
    let observer: PerformanceObserver | undefined;
    try {
      observer = new PerformanceObserver((list) => {
        const c = current.current;
        if (!c) return;
        for (const entry of list.getEntries()) {
          if (entry.startTime + entry.duration >= c.down - 200) c.tap.longTasks.push(Math.round(entry.duration));
        }
        update();
      });
      observer.observe({ type: "longtask" });
    } catch {
      // No long task timing in this browser.
    }
    return () => {
      document.removeEventListener("pointerdown", onDown, { capture: true });
      document.removeEventListener("pointerup", onUp, { capture: true });
      document.removeEventListener("click", onClick, { capture: true });
      observer?.disconnect();
    };
  }, []);

  // A new screen: when React committed it, and when the frame after it was drawn.
  useLayoutEffect(() => {
    const c = current.current;
    if (!c) return;
    c.tap.screenChanged = Math.round(performance.now() - c.down);
    requestAnimationFrame(() =>
      setTimeout(() => {
        c.tap.painted = Math.round(performance.now() - c.down);
        setTaps((list) => [{ ...c.tap }, ...list.filter((t) => t.target !== c.tap.target || t.downHandled !== c.tap.downHandled)].slice(0, 6));
      }, 0),
    );
  }, [location.pathname, location.search]);

  return (
    <div className="tap-timing" aria-hidden="true">
      <div>Messung (ms nach Fingerkontakt): ↓ angekommen · ↑ losgelassen · Klick · Bildschirm · gezeichnet · lange Aufgaben</div>
      {taps.map((tap, i) => (
        <div key={i}>
          {tap.target}: ↓{tap.downHandled} · ↑{tap.up ?? "–"} · K{tap.clickHandled ?? "–"} · B{tap.screenChanged ?? "–"} · G
          {tap.painted ?? "–"} · L[{tap.longTasks.join(",")}]
        </div>
      ))}
    </div>
  );
}
