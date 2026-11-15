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
  },
  members: {
    title: "Familienmitglieder",
    intro: "Für wen trägst du ein? Kinder brauchen kein eigenes Gerät.",
    none: "Noch niemand da. Füg das erste Familienmitglied hinzu!",
    add: "Mitglied hinzufügen",
    archivedTitle: "Archiviert",
    archivedIntro: "Archivierte Mitglieder bekommen keine neuen Einträge, ihr Verlauf bleibt erhalten.",
    moveUp: (name: string) => `${name} nach oben`,
    moveDown: (name: string) => `${name} nach unten`,
    edit: (name: string) => `${name} bearbeiten`,
    archive: (name: string) => `${name} archivieren`,
    unarchive: "Zurückholen",
    unarchiveLabel: (name: string) => `${name} zurückholen`,
    colourNames: {
      "#ff7a59": "Koralle",
      "#f5a524": "Bernstein",
      "#2bb673": "Grün",
      "#21a1c4": "Türkis",
      "#4a7cf7": "Blau",
      "#9b5de5": "Lila",
      "#e8508a": "Pink",
      "#8d6e63": "Braun",
    } as Record<string, string>,
    form: {
      addTitle: "Neues Familienmitglied",
      editTitle: (name: string) => `${name} bearbeiten`,
      name: "Name",
      emoji: "Bild",
      colour: "Farbe",
      save: "Speichern",
      cancel: "Abbrechen",
    },
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
