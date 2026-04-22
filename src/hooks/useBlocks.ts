"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/useAuthStore";

export function useBlockedIds() {
  const { user } = useAuthStore();
  return useQuery<string[]>({
    queryKey: ["blocks", user],
    queryFn: () => fetch("/api/blocks").then((r) => r.json()),
    enabled: !!user,
    staleTime: 60_000,
  });
}

export function useIsBlocked(targetId: string) {
  const { data: blocked = [] } = useBlockedIds();
  return blocked.includes(targetId);
}

export function useBlockUser() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  return useMutation({
    mutationFn: (blocked_id: string) =>
      fetch("/api/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocked_id }),
      }).then((r) => { if (!r.ok) throw new Error("Error al bloquear"); }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["blocks", user] });
      qc.invalidateQueries({ queryKey: ["friends"] });
      qc.invalidateQueries({ queryKey: ["posts"] });
    },
  });
}

export function useUnblockUser() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  return useMutation({
    mutationFn: (blockedId: string) =>
      fetch(`/api/blocks/${blockedId}`, { method: "DELETE" })
        .then((r) => { if (!r.ok) throw new Error("Error al desbloquear"); }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["blocks", user] });
      qc.invalidateQueries({ queryKey: ["posts"] });
    },
  });
}
