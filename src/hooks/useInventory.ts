import { useQuery } from "@tanstack/react-query";
import type { UserCard } from "@/types";

/**
 * Retorna el inventario (user_cards) del usuario autenticado.
 * Cada entrada incluye el join con cards (definición de fotocard).
 *
 * queryKey: ["inventory"]
 * staleTime: 30s — el inventario no cambia muy seguido
 */
export function useInventory() {
  return useQuery<UserCard[]>({
    queryKey: ["inventory"],
    queryFn: async () => {
      const res = await fetch("/api/cards/inventory");

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Failed to fetch inventory" }));
        throw new Error(
          (body as { error?: string }).error ?? "Failed to fetch inventory"
        );
      }

      const data = (await res.json()) as { cards: UserCard[] };
      return data.cards;
    },
    staleTime: 30_000,
  });
}
