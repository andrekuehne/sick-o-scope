// Every UI string lives here, in German. Components never hard-code text.
// Kept as one plain object so a second language can be added later
// by giving it the same shape (see `Strings`).

export const de = {
  appName: "Sick-o-Scope",
  appDescription: "Wer war wann krank? Das Familien-Krankheitstagebuch.",
  nav: {
    label: "Hauptnavigation",
    today: "Heute",
    timeline: "Verlauf",
    settings: "Einstellungen",
  },
  today: {
    title: "Heute",
    placeholder: "Hier trägst du bald ein, wem es wie geht.",
  },
  timeline: {
    title: "Verlauf",
    placeholder: "Hier siehst du bald, wer wann krank war.",
  },
  settings: {
    title: "Einstellungen",
    placeholder: "Hier verwaltest du bald Familie und Geräte.",
  },
  notFound: {
    title: "Seite nicht gefunden",
    text: "Diese Seite gibt es nicht.",
    back: "Zurück zu Heute",
  },
} as const;

export type Strings = typeof de;

/** The active UI strings. German is the only language for now. */
export const t: Strings = de;
