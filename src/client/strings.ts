// Every UI string lives here, in German. Components never hard-code text.
// Kept as one plain object so a second language can be added later
// by giving it the same shape (see `Strings`).

import type { Severity } from "../shared/check-ins.ts";

export const de = {
  /** For dates and numbers. */
  locale: "de-DE",
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
    dateBar: "Datum",
    previousDay: "Vorheriger Tag",
    nextDay: "Nächster Tag",
    pickDate: "Datum wählen",
    todayPrefix: "Heute",
    yesterdayPrefix: "Gestern",
    checkedIn: (done: number, total: number) => `${done} / ${total} eingetragen`,
    allHealthyToday: "Alle fit heute",
    allHealthyOn: (day: string) => `Alle fit am ${day}`,
    noMembers: "Noch keine Familienmitglieder. Leg sie in den Einstellungen an:",
    toSettings: "Zu den Einstellungen",
    gap: "Noch nichts eingetragen",
    healthy: "🙂 Fit",
    sick: (severityLabel: string) => `🤒 ${severityLabel}`,
    markHealthy: "Fit",
    markHealthyLabel: (name: string) => `${name} ist fit`,
    edit: (name: string) => `Eintrag von ${name} bearbeiten`,
    deleteEntry: "Eintrag löschen",
    cancel: "Abbrechen",
  },
  severity: {
    1: "Naja",
    2: "Angeschlagen",
    3: "Richtig krank",
    4: "Sofa-Kobold",
    5: "Totalausfall",
  } satisfies Record<Severity, string>,
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
