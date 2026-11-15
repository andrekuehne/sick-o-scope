// Checked in order: the first match wins (Edge and Samsung Internet also claim to be Chrome).
const SYSTEMS: [RegExp, string][] = [
  [/Android/, "Android"],
  [/iPhone|iPad|iPod/, "iOS"],
  [/Windows/, "Windows"],
  [/Mac OS X|Macintosh/, "macOS"],
  [/Linux/, "Linux"],
];
const BROWSERS: [RegExp, string][] = [
  [/SamsungBrowser/, "Samsung Internet"],
  [/Edg\//, "Edge"],
  [/Firefox|FxiOS/, "Firefox"],
  [/Chrome|CriOS/, "Chrome"],
  [/Safari/, "Safari"],
];

/**
 * A short, human label for a Device, such as "Android · Chrome", from its User-Agent.
 * Only for recognising Devices in the settings list; never used for decisions.
 */
export function deviceLabel(userAgent: string | undefined): string {
  const ua = userAgent ?? "";
  const first = (table: [RegExp, string][]) => table.find(([pattern]) => pattern.test(ua))?.[1];
  return [first(SYSTEMS), first(BROWSERS)].filter(Boolean).join(" · ") || "Unbekanntes Gerät";
}
