import { onlineManager } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";

const subscribe = (onChange: () => void) => onlineManager.subscribe(onChange);
const isOnline = () => onlineManager.isOnline();

/**
 * Whether this Device is online, as TanStack Query sees it (which also pauses fetching while
 * offline). Saving needs the network: while offline, every save action is disabled.
 */
export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, isOnline);
}
