// Every UI string lives here, in German. Components never hard-code text.
// Two exceptions, both because the Worker needs the words too: the Symptom catalog
// (src/shared/symptoms.ts), and the CSV export's headings and statuses (src/worker/export/csv.ts).
// Kept as one plain object so a second language can be added later
// by giving it the same shape (see `Strings`).

import type { Severity } from "../shared/check-ins.ts";

const days = (n: number) => `${n} ${n === 1 ? "Tag" : "Tage"}`;
const checkInCount = (n: number) => `${n} ${n === 1 ? "Eintrag" : "Einträge"}`;

export const de = {
  /** For dates and numbers. */
  locale: "de-DE",
  appName: "Sick-o-Scope",
  appDescription: "Wer war wann krank? Das Familien-Krankheitstagebuch.",
  loading: "Einen Moment …",
  /** Joins bits of one line, like "🤒 Richtig krank · Tag 3". */
  joined: (parts: string[]) => parts.join(" · "),
  noMembers: "Noch keine Familienmitglieder. Leg sie in den Einstellungen an:",
  toSettings: "Zu den Einstellungen",
  offline: "📴 Offline: Du siehst den zuletzt geladenen Stand. Speichern geht erst wieder mit Verbindung.",
  offlineNothingLoaded: "Ohne Verbindung lässt sich gerade nichts laden. Sobald du wieder online bist, geht’s weiter.",
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
    gap: "Noch nichts eingetragen",
    healthy: "🙂 Fit",
    sick: (severityIcon: string, severityLabel: string) => `${severityIcon} ${severityLabel}`,
    markHealthy: "Fit",
    markHealthyLabel: (name: string) => `${name} ist fit`,
    markSick: "Krank…",
    markSickLabel: (name: string) => `${name} ist krank`,
    /** The Sick day before the selected date: "Gestern" when that's today, else "Am Vortag". */
    previousDaySick: (isToday: boolean, severityIcon: string, severityLabel: string) =>
      `${isToday ? "Gestern" : "Am Vortag"}: ${severityIcon} ${severityLabel}`,
    sickDay: (n: number) => `Tag ${n}`,
    shortcut: { better: "Besser", same: "Gleich", worse: "Schlechter" },
    shortcutLabel: (name: string, shortcut: string) => `${name}: ${shortcut}`,
    familyStreak: (since: string, n: number) => `🌞 Alle fit seit ${since} (${days(n)})`,
    previousFamilyStreak: (n: number) => `Letzte Fit-Strähne: ${days(n)}`,
    edit: (name: string) => `Eintrag von ${name} bearbeiten`,
  },
  gapFill: {
    /** "Luna: 3 Tage fehlen (12.–14. Nov.)" */
    title: (names: string, n: number, range: string) => `${names}: ${n === 1 ? "1 Tag fehlt" : `${n} Tage fehlen`} (${range})`,
    allHealthy: "Alle fit",
    likeLast: "Wie zuletzt",
    oneByOne: "Einzeln eintragen",
    dismiss: "Ausblenden",
    /** What fill-gaps did: days it wrote, and days someone had logged in the meantime. */
    result: (written: number, skipped: number) =>
      `✅ ${checkInCount(written)} gespeichert.` +
      (skipped > 0 ? ` ${checkInCount(skipped)} gab es schon, ${skipped === 1 ? "der blieb" : "die blieben"} unverändert.` : ""),
  },
  sheet: {
    title: (name: string, day: string) => `${name} · ${day}`,
    status: "Wie geht’s?",
    healthy: "Fit",
    sick: "Krank",
    severity: "Wie schlimm?",
    pickSeverity: "Wähl noch aus, wie schlimm es ist.",
    symptoms: "Was ist los?",
    symptomsHint: "Optional: auch ohne Symptome speicherbar.",
    note: "Notiz",
    notePlaceholder: "z. B. Fieber nachts 39,2",
    save: "Speichern",
    deleteCheckIn: "Eintrag löschen",
    cancel: "Abbrechen",
    skip: "Überspringen",
    /** Where Einzeln eintragen is: "2 von 3". */
    step: (n: number, of: number) => `${n} von ${of}`,
  },
  severity: {
    0: "Fast gesund",
    1: "Naja",
    2: "Angeschlagen",
    3: "Richtig krank",
    4: "Sofa-Kobold",
    5: "Totalausfall",
  } satisfies Record<Severity, string>,
  /** Placeholder pictures for the Severity steps, next to their labels. */
  severityIcon: {
    0: "🌤️",
    1: "🙁",
    2: "😷",
    3: "🤒",
    4: "🛋️",
    5: "😵",
  } satisfies Record<Severity, string>,
  timeline: {
    title: "Verlauf",
    season: (label: string) => `Saison ${label}`,
    seasonBar: "Saison",
    previousSeason: "Vorherige Saison",
    nextSeason: "Nächste Saison",
    zoom: "Zoom",
    zoomSteps: { day: "Tag", week: "Woche", month: "Monat" },
    legend: "Legende",
    healthy: "Fit",
    gap: "Nicht eingetragen",
    empty: "In dieser Saison gibt es keine Einträge.",
    /** A day or several in a Member's lane: "Luna, Sa., 14. Nov.: Richtig krank". */
    days: (name: string, when: string, status: string) => `${name}, ${when}: ${status}`,
    /** "Richtig krank (Husten, Fieber)" */
    withSymptoms: (severityLabel: string, symptomNames: string[]) => `${severityLabel} (${symptomNames.join(", ")})`,
    /** In place of the Badges that don't fit on a day. */
    moreBadges: (n: number) => `+${n}`,
  },
  settings: {
    title: "Einstellungen",
    signedInAs: (user: string, family: string) => `Angemeldet als ${user} · ${family}`,
    signOut: "Dieses Gerät abmelden",
    exportTitle: "Daten",
    exportIntro: "Alle Einträge als Tabelle, zum Beispiel für Excel oder Google Tabellen. Eure Daten gehören euch.",
    exportCsv: "CSV exportieren",
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
  reminder: {
    title: "Erinnerung",
    intro: "Eine tägliche Benachrichtigung auf diesem Gerät, wenn heute noch nicht alle eingetragen sind.",
    on: "Täglich erinnern",
    time: "Uhrzeit",
    blocked: "Benachrichtigungen sind für diese App blockiert. Du kannst sie in den Einstellungen des Handys erlauben.",
    unavailable: "Auf diesem Gerät gehen keine Erinnerungen. Installier die App auf dem Handy, dann klappt's.",
  },
  users: {
    title: "Geräte & Zugang",
    intro: "Wer hier steht, kann für alle eintragen, Geräte abmelden und Leute entfernen.",
    you: (name: string) => `${name} (du)`,
    thisDevice: "Dieses Gerät",
    lastActive: (when: string) => `zuletzt aktiv ${when}`,
    noDevices: "Kein Gerät angemeldet",
    signOutDevice: "Abmelden",
    signOutDeviceLabel: (device: string, name: string) => `${device} von ${name} abmelden`,
    confirmSignOutDevice: (device: string, name: string) =>
      `${device} von ${name} abmelden? Das Gerät braucht danach einen neuen Anmelde-Link.`,
    remove: "Entfernen",
    removeLabel: (name: string) => `${name} entfernen`,
    confirmRemove: (name: string) =>
      `${name} entfernen? Alle Geräte von ${name} werden abgemeldet. Die Einträge bleiben erhalten.`,
    addDevice: "Gerät hinzufügen",
  },
  addDevice: {
    title: "Gerät hinzufügen",
    forWhom: "Für wen ist das Gerät?",
    newUser: "Jemand Neues",
    newUserName: "Name",
    create: "Anmelde-Link erstellen",
    linkFor: (name: string) => `Anmelde-Link für ${name}`,
    howTo: "Öffne den Link auf dem neuen Gerät oder scanne dort den QR-Code.",
    validUntil: (when: string) => `Der Link funktioniert einmal und gilt bis ${when}.`,
    share: "Link teilen",
    copy: "Link kopieren",
    copied: "Kopiert ✓",
    shareText: (name: string) => `Hier ist dein Anmelde-Link für Sick-o-Scope, ${name}:`,
    qrCode: "QR-Code mit dem Anmelde-Link",
    link: "Anmelde-Link",
    done: "Fertig",
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
