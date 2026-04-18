import type { SupabaseClient } from "@supabase/supabase-js";

export type Rarity = "common" | "rare" | "epic" | "legendary";

const BASE_RATES: Record<Rarity, number> = {
  legendary: 0.03,
  epic:      0.14,
  rare:      0.28,
  common:    0.55,
};

const SUPER_FIRST_RATES: Record<Rarity, number> = {
  legendary: 0.07,
  epic:      0.28,
  rare:      0.65,
  common:    0,
};

function rollRarity(rates: Record<Rarity, number>): Rarity {
  const roll = Math.random();
  let acc = 0;
  for (const [rarity, prob] of Object.entries(rates) as [Rarity, number][]) {
    acc += prob;
    if (roll < acc) return rarity;
  }
  return "common";
}

export async function pickCards(
  db: SupabaseClient,
  packType: "simple" | "super"
): Promise<string[]> {
  const { data: allCards } = await db.from("cards").select("id, rarity");
  if (!allCards || allCards.length === 0) return [];

  const byRarity: Record<string, string[]> = {};
  for (const card of allCards) {
    if (!byRarity[card.rarity]) byRarity[card.rarity] = [];
    byRarity[card.rarity].push(card.id);
  }

  function pickOne(rates: Record<Rarity, number>): string | null {
    const rarity = rollRarity(rates);
    const pool = byRarity[rarity] ?? byRarity["common"] ?? [];
    if (pool.length === 0) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  const count = packType === "super" ? 3 : 1;
  const results: string[] = [];

  for (let i = 0; i < count; i++) {
    const rates = packType === "super" && i === 0 ? SUPER_FIRST_RATES : BASE_RATES;
    const id = pickOne(rates);
    if (id) results.push(id);
  }

  return results;
}
