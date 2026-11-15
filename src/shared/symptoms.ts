// The fixed Symptom catalog, shared by the client and the Worker (GLOSSARY.md: Symptom, Badge).
// Check-ins store only the keys, so a key is never renamed or removed once it has shipped;
// names, Badges and groups can change freely. The emoji Badges are placeholders for pictures.

/** In display order: the groups, and the Symptoms within each. */
export const SYMPTOM_GROUPS = [
  {
    name: "Hals, Nase & Ohren",
    symptoms: [
      { key: "runny-nose", name: "Schnupfen", badge: "🤧" },
      { key: "stuffy-nose", name: "Verstopfte Nase", badge: "👃" },
      { key: "sinuses", name: "Nebenhöhlen", badge: "😖" },
      { key: "phlegm", name: "Schleimbrocken", badge: "🟢" },
      { key: "cough", name: "Husten", badge: "😮‍💨" },
      { key: "sore-throat", name: "Halsweh", badge: "🗣️" },
      { key: "earache", name: "Ohrenweh", badge: "👂" },
      { key: "itchy-ears", name: "Ohrenjucken", badge: "🪶" },
    ],
  },
  {
    name: "Allgemein",
    symptoms: [
      { key: "fever", name: "Fieber", badge: "🤒" },
      { key: "fatigue", name: "Erschöpft", badge: "😴" },
      { key: "headache", name: "Kopfweh", badge: "🤕" },
      { key: "body-aches", name: "Gliederschmerzen", badge: "🦴" },
    ],
  },
  {
    name: "Bauch",
    symptoms: [
      { key: "nausea", name: "Übelkeit", badge: "🤢" },
      { key: "vomiting", name: "Erbrechen", badge: "🤮" },
      { key: "diarrhea", name: "Durchfall", badge: "💩" },
      { key: "stomach-ache", name: "Bauchweh", badge: "🌀" },
    ],
  },
  {
    name: "Sonstiges",
    symptoms: [
      { key: "allergy", name: "Allergie", badge: "🌼" },
      { key: "mystery-bug", name: "Mystery-Bug", badge: "👾" },
    ],
  },
] as const;

export type SymptomKey = (typeof SYMPTOM_GROUPS)[number]["symptoms"][number]["key"];
export type Symptom = { key: SymptomKey; name: string; badge: string };

const ALL = SYMPTOM_GROUPS.flatMap((group): readonly Symptom[] => group.symptoms);

export const SYMPTOM_KEYS = ALL.map((s) => s.key) as [SymptomKey, ...SymptomKey[]];

const BY_KEY = new Map(ALL.map((s) => [s.key, s]));

export function symptom(key: SymptomKey): Symptom {
  return BY_KEY.get(key)!;
}

/** The given keys in catalog order, however they were stored or picked. */
export function inCatalogOrder(keys: readonly SymptomKey[]): SymptomKey[] {
  return SYMPTOM_KEYS.filter((key) => keys.includes(key));
}
