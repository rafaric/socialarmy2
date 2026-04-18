"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/browser";
import type { Rarity } from "@/lib/card-distribution";

export interface PendingPack {
  id: string;
  pack_type: "simple" | "super";
  activity: string;
  created_at: string;
}

export interface CardResult {
  id: string;
  name: string;
  image_url: string;
  era: string | null;
  member: string | null;
  rarity: Rarity;
}

export interface UserCard {
  id: string;
  card_id: string;
  for_trade: boolean;
  obtained_at: string;
  cards: CardResult;
}

export function usePendingPacks() {
  return useQuery<PendingPack[]>({
    queryKey: ["packs", "pending"],
    queryFn: async () => {
      const res = await fetch("/api/packs/pending");
      if (!res.ok) throw new Error("Error");
      const { packs } = await res.json();
      return packs;
    },
    refetchInterval: 30_000,
  });
}

export function useOpenPack() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (packId: string): Promise<CardResult[]> => {
      const res = await fetch(`/api/packs/open/${packId}`, { method: "POST" });
      if (!res.ok) throw new Error("Error abriendo sobre");
      const { cards } = await res.json();
      return cards;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["packs", "pending"] });
      qc.invalidateQueries({ queryKey: ["collection"] });
    },
  });
}

export function useCollection(userId: string | null) {
  return useQuery<UserCard[]>({
    queryKey: ["collection", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_cards")
        .select("id, card_id, for_trade, obtained_at, cards(*)")
        .eq("user_id", userId!)
        .order("obtained_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as UserCard[];
    },
    enabled: !!userId,
  });
}

export function useAwardPack() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ activity, ref_id }: { activity: string; ref_id?: string }) => {
      const res = await fetch("/api/packs/award", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activity, ref_id }),
      });
      if (!res.ok) throw new Error("Error");
      return res.json();
    },
    onSuccess: (data) => {
      if (!data.already_rewarded) {
        qc.invalidateQueries({ queryKey: ["packs", "pending"] });
      }
    },
  });
}

export function useLoginStreak() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/packs/login-streak", { method: "POST" });
      if (!res.ok) throw new Error("Error");
      return res.json();
    },
    onSuccess: (data) => {
      if (data.pack) qc.invalidateQueries({ queryKey: ["packs", "pending"] });
    },
  });
}
