// Every UI string lives here, in German. Components never hard-code text.
// Kept as one plain object so a second language can be added later
// by giving it the same shape (see `Strings`).

export const de = {
  appName: "Sick-o-Scope",
  appDescription: "Wer war wann krank? Das Familien-Krankheitstagebuch.",
  loading: "Einen Moment …",
  offlineOrError: "Das hat nicht geklappt. Bitte prüf die Verbindung und versuch es nochmal.",
  askForNewLink: "Bitte lass dir von jemandem aus deiner Familie einen neuen Anmelde-Link schicken.",
  nav: {
    label: "Hauptnavigation",
    today: "Heute",
    timeline: "Verlauf",
    settings: "Einstellungen",
  },
  signIn: {
    title: "Willkommen bei Sick-o-Scope 👋",
    text: "Tippe auf „Anmelden“, um dieses Gerät für deine Familie anzumelden.",
    button: "Anmelden",
    busy: "Wird angemeldet …",
    failed: {
      unknown: "Dieser Link ist ungültig.",
      used: "Dieser Link wurde schon benutzt.",
      expired: "Dieser Link ist abgelaufen.",
    },
  },
  signedOut: {
    title: "Du bist nicht angemeldet",
  },
  today: {
    title: "Heute",
    greeting: (name: string) => `Hallo ${name} 👋`,
    placeholder: "Hier trägst du bald ein, wem es wie geht.",
  },
  timeline: {
    title: "Verlauf",
    placeholder: "Hier siehst du bald, wer wann krank war.",
  },
  settings: {
    title: "Einstellungen",
    signedInAs: (user: string, family: string) => `Angemeldet als ${user} · ${family}`,
    signOut: "Abmelden",
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
