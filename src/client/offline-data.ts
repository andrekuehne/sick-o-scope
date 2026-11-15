// The last loaded data, kept in this browser so the app shows it when opened offline
// (decided with the Family: kept for 7 days, dropped as soon as the Device is signed out).
// A lost Device that stays offline still shows it until then; signing it out remotely takes
// effect the next time it goes online.

import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import type { QueryClient } from "@tanstack/react-query";
import type { PersistQueryClientOptions } from "@tanstack/react-query-persist-client";
import { ME_KEY } from "./me.ts";

const STORAGE_KEY = "sick-o-scope:data";

/** How long the last loaded data is kept, for opening the app offline. */
export const KEEP_OFFLINE_MS = 7 * 24 * 60 * 60 * 1000;

export const offlineDataOptions: Omit<PersistQueryClientOptions, "queryClient"> = {
  persister: createSyncStoragePersister({ storage: window.localStorage, key: STORAGE_KEY }),
  maxAge: KEEP_OFFLINE_MS,
  // Bump when the shape of cached data changes, so an old copy is thrown away instead of misread.
  buster: "1",
};

/**
 * Drops the Family's data, in memory and in storage, right away: on sign-out, and before
 * another sign-in on this browser. Only who's signed in (`/api/me`) stays.
 */
export function forgetOfflineData(queryClient: QueryClient) {
  queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== ME_KEY[0] });
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable: then nothing was kept there either.
  }
}
