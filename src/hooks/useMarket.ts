import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  MarketListing,
  TradeOffer,
  UserCard,
  ListingsQuery,
  CreateListingPayload,
  CreateOfferPayload,
} from "@/types";

// ---------------------------------------------------------------------------
// Tipos internos de respuesta
// ---------------------------------------------------------------------------

interface ListingsResponse {
  listings: MarketListing[];
  next_cursor: string | null;
}

interface ListingResponse {
  listing: MarketListing;
}

interface OffersResponse {
  offers: TradeOffer[];
}

interface CreateListingResponse {
  listing: MarketListing;
}

interface CreateOfferResponse {
  offer: TradeOffer;
}

interface AcceptOfferResponse {
  ok: boolean;
  trade_id: string;
}

// ---------------------------------------------------------------------------
// Queries — mercado global
// ---------------------------------------------------------------------------

/**
 * Listados activos del mercado con filtros opcionales.
 * Devuelve la primera página (sin cursor). Para paginación infinita,
 * usar useInfiniteQuery en la UI directamente.
 *
 * queryKey: ["market", "listings", filters]
 * staleTime: 15s | refetchInterval: 30s (hasta que Realtime esté en Fase 5)
 */
export function useMarketListings(filters?: ListingsQuery) {
  return useQuery<ListingsResponse>({
    queryKey: ["market", "listings", filters ?? {}],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.rarity) params.set("rarity", filters.rarity);
      if (filters?.cursor) params.set("cursor", filters.cursor);
      if (filters?.limit != null) params.set("limit", String(filters.limit));

      const url = params.toString()
        ? `/api/market/listings?${params.toString()}`
        : "/api/market/listings";

      const res = await fetch(url);

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Failed to fetch listings" }));
        throw new Error(
          (body as { error?: string }).error ?? "Failed to fetch listings"
        );
      }

      return res.json() as Promise<ListingsResponse>;
    },
    staleTime: 15_000,
    refetchInterval: 30_000, // Fase 5: reemplazar por Realtime subscription
  });
}

/**
 * Detalle de un listing individual.
 *
 * queryKey: ["market", "listing", id]
 */
export function useListing(id: string) {
  return useQuery<MarketListing>({
    queryKey: ["market", "listing", id],
    queryFn: async () => {
      const res = await fetch(`/api/market/listings/${id}`);

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Failed to fetch listing" }));
        throw new Error(
          (body as { error?: string }).error ?? "Failed to fetch listing"
        );
      }

      const data = (await res.json()) as ListingResponse;
      return data.listing;
    },
    enabled: !!id,
    staleTime: 15_000,
  });
}

/**
 * Ofertas pendientes de un listing (solo disponible para el seller).
 * Usa refetchInterval de 15s como fallback hasta que Realtime esté habilitado.
 *
 * queryKey: ["market", "listing", listingId, "offers"]
 */
export function useListingOffers(listingId: string) {
  return useQuery<TradeOffer[]>({
    queryKey: ["market", "listing", listingId, "offers"],
    queryFn: async () => {
      const res = await fetch(`/api/market/listings/${listingId}/offers`);

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Failed to fetch offers" }));
        throw new Error(
          (body as { error?: string }).error ?? "Failed to fetch offers"
        );
      }

      const data = (await res.json()) as OffersResponse;
      return data.offers;
    },
    enabled: !!listingId,
    staleTime: 10_000,
    refetchInterval: 15_000, // TODO Fase 5 — reemplazar por Realtime en trade_offers
  });
}

/**
 * Listings activos creados por el usuario autenticado.
 *
 * queryKey: ["market", "my-listings"]
 */
export function useMyListings() {
  return useQuery<MarketListing[]>({
    queryKey: ["market", "my-listings"],
    queryFn: async () => {
      const res = await fetch("/api/market/my-listings");

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Failed to fetch my listings" }));
        throw new Error(
          (body as { error?: string }).error ?? "Failed to fetch my listings"
        );
      }

      const data = (await res.json()) as { listings: MarketListing[] };
      return data.listings;
    },
    staleTime: 30_000,
  });
}

/**
 * Ofertas enviadas por el usuario autenticado, con filtro opcional de status.
 *
 * queryKey: ["my-offers", status?]
 */
export function useMyOffers(status?: string) {
  return useQuery<TradeOffer[]>({
    queryKey: ["my-offers", status ?? "all"],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      const url = params.toString()
        ? `/api/market/my-offers?${params.toString()}`
        : "/api/market/my-offers";

      const res = await fetch(url);

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Failed to fetch my offers" }));
        throw new Error(
          (body as { error?: string }).error ?? "Failed to fetch my offers"
        );
      }

      const data = (await res.json()) as { offers: TradeOffer[] };
      return data.offers;
    },
    staleTime: 30_000,
  });
}

// ---------------------------------------------------------------------------
// Mutations — mercado
// ---------------------------------------------------------------------------

/**
 * Crear un nuevo listing.
 * Optimistic update: decrementa quantity de la carta en el cache de inventory.
 * onSuccess: invalida inventory, market listings y my-listings.
 */
interface InventoryContext {
  previousInventory: UserCard[] | undefined;
}

export function useCreateListing() {
  const queryClient = useQueryClient();

  return useMutation<CreateListingResponse, Error, CreateListingPayload, InventoryContext>({
    mutationFn: async (payload) => {
      const res = await fetch("/api/market/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Failed to create listing" }));
        throw new Error(
          (body as { error?: string }).error ?? "Failed to create listing"
        );
      }

      return res.json() as Promise<CreateListingResponse>;
    },

    onMutate: async (payload) => {
      // Cancelar queries en curso para evitar race conditions
      await queryClient.cancelQueries({ queryKey: ["inventory"] });

      // Snapshot del estado anterior para rollback
      const previousInventory = queryClient.getQueryData<UserCard[]>(["inventory"]);

      // Optimistic update: decrementar quantity de la carta listada
      if (previousInventory) {
        queryClient.setQueryData<UserCard[]>(["inventory"], (old) =>
          (old ?? []).map((card) =>
            card.card_definition_id === payload.card_definition_id
              ? { ...card, quantity: card.quantity - 1 }
              : card
          )
        );
      }

      return { previousInventory };
    },

    onError: (_err, _payload, context) => {
      // Rollback del optimistic update
      if (context?.previousInventory !== undefined) {
        queryClient.setQueryData(["inventory"], context.previousInventory);
      }
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["market", "listings"] });
      queryClient.invalidateQueries({ queryKey: ["market", "my-listings"] });
    },
  });
}

/**
 * Cancelar un listing activo.
 * onSuccess: invalida inventory, my-listings y el listing específico.
 */
export function useCancelListing() {
  const queryClient = useQueryClient();

  return useMutation<{ ok: boolean }, Error, { id: string }>({
    mutationFn: async ({ id }) => {
      const res = await fetch(`/api/market/listings/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Failed to cancel listing" }));
        throw new Error(
          (body as { error?: string }).error ?? "Failed to cancel listing"
        );
      }

      return res.json() as Promise<{ ok: boolean }>;
    },

    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["market", "my-listings"] });
      queryClient.invalidateQueries({ queryKey: ["market", "listing", id] });
      queryClient.invalidateQueries({ queryKey: ["market", "listings"] });
    },
  });
}

/**
 * Crear una oferta sobre un listing.
 * Optimistic update: incrementa locked_quantity de la carta ofrecida en inventory.
 * onSuccess: invalida inventory y offers del listing.
 */
export function useCreateOffer() {
  const queryClient = useQueryClient();

  return useMutation<
    CreateOfferResponse,
    Error,
    CreateOfferPayload & { listingId: string },
    InventoryContext
  >({
    mutationFn: async ({ listingId, offered_card_id }) => {
      const res = await fetch(`/api/market/listings/${listingId}/offers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offered_card_id }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Failed to create offer" }));
        throw new Error(
          (body as { error?: string }).error ?? "Failed to create offer"
        );
      }

      return res.json() as Promise<CreateOfferResponse>;
    },

    onMutate: async ({ offered_card_id }) => {
      await queryClient.cancelQueries({ queryKey: ["inventory"] });

      const previousInventory = queryClient.getQueryData<UserCard[]>(["inventory"]);

      // Optimistic update: incrementar locked_quantity de la carta ofrecida
      if (previousInventory) {
        queryClient.setQueryData<UserCard[]>(["inventory"], (old) =>
          (old ?? []).map((card) =>
            card.card_definition_id === offered_card_id
              ? { ...card, locked_quantity: card.locked_quantity + 1 }
              : card
          )
        );
      }

      return { previousInventory };
    },

    onError: (_err, _payload, context) => {
      if (context?.previousInventory !== undefined) {
        queryClient.setQueryData(["inventory"], context.previousInventory);
      }
    },

    onSuccess: (data, { listingId }) => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({
        queryKey: ["market", "listing", listingId, "offers"],
      });

      // Si la oferta fue auto-aceptada, el listing cambió de estado
      if (data.offer.status === "accepted") {
        queryClient.invalidateQueries({ queryKey: ["market", "listings"] });
        queryClient.invalidateQueries({ queryKey: ["trade-history"] });
      }
    },
  });
}

/**
 * Aceptar una oferta (rol: seller).
 * onSuccess: invalida todo ["market"], ["inventory"] y ["trade-history"].
 */
export function useAcceptOffer() {
  const queryClient = useQueryClient();

  return useMutation<
    AcceptOfferResponse,
    Error,
    { listingId: string; offerId: string }
  >({
    mutationFn: async ({ listingId, offerId }) => {
      const res = await fetch(
        `/api/market/listings/${listingId}/offers/${offerId}/accept`,
        { method: "POST" }
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Failed to accept offer" }));
        throw new Error(
          (body as { error?: string }).error ?? "Failed to accept offer"
        );
      }

      return res.json() as Promise<AcceptOfferResponse>;
    },

    onSuccess: () => {
      // El trade cambia el estado de inventario de ambas partes — invalidar todo
      queryClient.invalidateQueries({ queryKey: ["market"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["trade-history"] });
    },
  });
}

/**
 * Cancelar una oferta propia (rol: buyer).
 * onSuccess: invalida inventory, offers del listing y my-offers.
 */
export function useCancelOffer() {
  const queryClient = useQueryClient();

  return useMutation<{ ok: boolean }, Error, { listingId: string; offerId: string }>({
    mutationFn: async ({ listingId, offerId }) => {
      const res = await fetch(
        `/api/market/listings/${listingId}/offers/${offerId}`,
        { method: "DELETE" }
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Failed to cancel offer" }));
        throw new Error(
          (body as { error?: string }).error ?? "Failed to cancel offer"
        );
      }

      return res.json() as Promise<{ ok: boolean }>;
    },

    onSuccess: (_data, { listingId }) => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({
        queryKey: ["market", "listing", listingId, "offers"],
      });
      queryClient.invalidateQueries({ queryKey: ["my-offers"] });
    },
  });
}
