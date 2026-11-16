import type { Season } from "../../shared/history.ts";
import { t } from "../strings.ts";

/**
 * Picks a Season, one step back or forward at a time ("◀️ Saison 2026/27 ▶️"). Each screen
 * says which Seasons are next to the shown one; null disables that way.
 */
export function SeasonBar({
  season,
  previous,
  next,
  onChange,
}: {
  season: Season;
  previous: Season | null;
  next: Season | null;
  onChange: (season: Season) => void;
}) {
  return (
    <nav className="date-bar" aria-label={t.seasonBar.label}>
      <button
        type="button"
        className="icon-button"
        aria-label={t.seasonBar.previous}
        disabled={!previous}
        onClick={() => previous && onChange(previous)}
      >
        ◀️
      </button>
      <span className="date-bar-label">{t.seasonBar.season(season.label)}</span>
      <button
        type="button"
        className="icon-button"
        aria-label={t.seasonBar.next}
        disabled={!next}
        onClick={() => next && onChange(next)}
      >
        ▶️
      </button>
    </nav>
  );
}
