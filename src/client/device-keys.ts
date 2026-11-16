// Small lists of keys this Device remembers in local storage (dismissed gap-fill cards, shown
// celebrations). They're conveniences: without storage (private mode, blocked) they're simply
// forgotten, and nothing else breaks.

/** The keys stored under `storageKey`; none when there's nothing or storage is unavailable. */
export function loadKeys(storageKey: string): string[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
    return Array.isArray(stored) ? stored.filter((key) => typeof key === "string") : [];
  } catch {
    return [];
  }
}

/** Stores the keys, only the latest `keep` of them. */
export function saveKeys(storageKey: string, keys: string[], keep: number) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(keys.slice(-keep)));
  } catch {
    // Not stored: forgotten when the app is reopened, which does no harm.
  }
}
