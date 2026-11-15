import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { CheckInStateInput, FillGapsRequest, FillGapsResult } from "../shared/check-ins.ts";
import { deleteCheckIn, fetchCheckIns, fillGaps, saveCheckIn } from "./api.ts";

const checkInsKey = (familyId: string) => ["check-ins", familyId] as const;

/** The Family's Check-ins from `from` to `to`; refetched when the app opens or comes back. */
export function useCheckIns(familyId: string, from: string, to: string) {
  return useQuery({
    queryKey: [...checkInsKey(familyId), from, to],
    queryFn: () => fetchCheckIns(familyId, from, to),
  });
}

/** Called after this one write: on success once the refreshed Check-ins are in. */
export type WriteCallbacks<Result = unknown> = { onSuccess?: (result: Result) => void; onError?: () => void };

/**
 * Writing Check-ins. Every write refreshes whatever Check-ins are on screen, and stays
 * `busy` until that refresh is done. `failed` is about the latest write only.
 */
export function useCheckInWrites(familyId: string) {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: checkInsKey(familyId) });
  const [latest, setLatest] = useState<"save" | "remove" | "fill" | null>(null);

  const save = useMutation({
    mutationFn: (args: { date: string; memberId: string; state: CheckInStateInput }) =>
      saveCheckIn(familyId, args.date, args.memberId, args.state),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (args: { date: string; memberId: string }) => deleteCheckIn(familyId, args.date, args.memberId),
    onSuccess: refresh,
  });
  const fill = useMutation({
    mutationFn: (checkIns: FillGapsRequest["checkIns"]) => fillGaps(familyId, checkIns),
    onSuccess: refresh,
  });
  const byName = { save, remove, fill };

  return {
    save: (args: Parameters<typeof save.mutate>[0], callbacks?: WriteCallbacks) => {
      setLatest("save");
      save.mutate(args, callbacks);
    },
    remove: (args: Parameters<typeof remove.mutate>[0], callbacks?: WriteCallbacks) => {
      setLatest("remove");
      remove.mutate(args, callbacks);
    },
    /** Writes only into Gaps; the result says which days were written and which already had a Check-in. */
    fill: (checkIns: Parameters<typeof fill.mutate>[0], callbacks?: WriteCallbacks<FillGapsResult>) => {
      setLatest("fill");
      fill.mutate(checkIns, callbacks);
    },
    busy: save.isPending || remove.isPending || fill.isPending,
    failed: latest !== null && byName[latest].isError,
  };
}
