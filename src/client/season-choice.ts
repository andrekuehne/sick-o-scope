import { useSearchParams } from "react-router";
import { type Season, seasonOf } from "../shared/history.ts";

/** The address parameter naming the shown Season by its first year: "?saison=2025" for 2025/26. */
const PARAM = "saison";

/** How a Season is written in the address: its first year. */
function paramOf(season: Season): string {
  return season.start.slice(0, 4);
}

/** The Season written in the address; null when it's missing or malformed. */
function seasonFromParam(value: string | null): Season | null {
  return value && /^\d{4}$/.test(value) ? seasonOf(`${value}-09-01`) : null;
}

/**
 * The Season shown on Verlauf, the Saison tab and the Person screen. It lives in the address,
 * so Back from a Person screen returns to the Season that was shown, and a Person screen opens
 * on the Season it was opened from. The current Season leaves the address plain; anything
 * malformed or still to come shows the current one.
 */
export function useSeasonChoice(today: string): [Season, (season: Season) => void] {
  const [params, setParams] = useSearchParams();
  const current = seasonOf(today);
  const named = seasonFromParam(params.get(PARAM));
  const season = named && named.start <= current.start ? named : current;
  const choose = (picked: Season) =>
    setParams(picked.start === current.start ? {} : { [PARAM]: paramOf(picked) }, { replace: true });
  return [season, choose];
}

/** A Member's Person screen, on the given Season (the current one when left out). */
export function personPath(memberId: string, season?: Season): string {
  const path = `/person/${encodeURIComponent(memberId)}`;
  return season ? `${path}?${PARAM}=${paramOf(season)}` : path;
}

/** The Seasons that have Check-ins, plus the current one and the shown one, oldest first. */
export function seasonsToPick(checkIns: { date: string }[], current: Season, shown: Season): Season[] {
  const byStart = new Map([
    [current.start, current],
    [shown.start, shown],
  ]);
  for (const { date } of checkIns) {
    const season = seasonOf(date);
    byStart.set(season.start, season);
  }
  return [...byStart.values()].sort((a, b) => (a.start < b.start ? -1 : 1));
}
