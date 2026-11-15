import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Me } from "../shared/auth.ts";
import { fetchMe } from "./api.ts";

export const ME_KEY = ["me"] as const;

/** Who is signed in on this Device: `undefined` while loading, `null` when signed out. */
export function useMe() {
  return useQuery({ queryKey: ME_KEY, queryFn: fetchMe });
}

/** Records a sign-in or sign-out without waiting for a refetch. */
export function useSetMe() {
  const queryClient = useQueryClient();
  return (me: Me | null) => queryClient.setQueryData(ME_KEY, me);
}
