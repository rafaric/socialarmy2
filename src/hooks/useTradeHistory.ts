import { useQuery } from "@tanstack/react-query";
import type { TradeHistory } from "@/types";

/**
 * Retorna el historial de intercambios del usuario autenticado.
 * Incluye joins con listed_card, offered_card, seller y buyer.
 *
 * queryKey: ["trade-history"]
 * staleTime: 60s — el historial es inmutable, no cambia frecuentemente
 */
export function useTradeHistory() {
  return useQuery<TradeHistory[]>({
    queryKey: ["trade-history"],
    queryFn: async () => {
      const res = await fetch("/api/market/trade-history");

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Failed to fetch trade history" }));
        throw new Error(
          (body as { error?: string }).error ?? "Failed to fetch trade history"
        );
      }

      const data = (await res.json()) as { history: TradeHistory[] };
      return data.history;
    },
    staleTime: 60_000,
  });
}
