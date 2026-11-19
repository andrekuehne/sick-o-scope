// The fixed Medication catalog, shared by the client and the Worker (GLOSSARY.md: Medication, Badge).
// Check-ins store only the keys, so a key is never renamed or removed once it has shipped;
// names, Badges and order can change freely. The emoji Badges are placeholders for pictures.

/** In display order. */
export const MEDICATIONS = [
  { key: "paracetamol", name: "Paracetamol", badge: "🌡️" },
  { key: "ibuprofen", name: "Ibuprofen", badge: "💊" },
  { key: "nasal-spray", name: "Nasenspray", badge: "💦" },
  { key: "cough-syrup", name: "Hustensaft", badge: "🥄" },
  { key: "antibiotics", name: "Antibiotika", badge: "🧫" },
] as const;

export type MedicationKey = (typeof MEDICATIONS)[number]["key"];
export type Medication = { key: MedicationKey; name: string; badge: string };

export const MEDICATION_KEYS = MEDICATIONS.map((m) => m.key) as [MedicationKey, ...MedicationKey[]];

const BY_KEY = new Map<MedicationKey, Medication>(MEDICATIONS.map((m) => [m.key, m]));

export function medication(key: MedicationKey): Medication {
  return BY_KEY.get(key)!;
}

/** The given keys in catalog order, however they were stored or picked. */
export function medicationsInCatalogOrder(keys: readonly MedicationKey[]): MedicationKey[] {
  return MEDICATION_KEYS.filter((key) => keys.includes(key));
}
