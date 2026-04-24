import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import type { MarketListing, TradeOffer, UserCard } from "@/types";

// Usar React Query real
vi.unmock("@tanstack/react-query");

// Mock fetch global
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Mock Supabase browser
vi.mock("@/lib/supabase/browser", () => ({
  supabase: {
    auth: { getUser: vi.fn() },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null }),
    })),
  },
}));

function wrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

const MOCK_LISTING: MarketListing = {
  id: "listing-1",
  seller_id: "seller-1",
  card_definition_id: "card-def-1",
  auto_accept: false,
  status: "active",
  expires_at: "2026-05-23T00:00:00Z",
  created_at: "2026-04-23T00:00:00Z",
  completed_at: null,
  cards: {
    id: "card-def-1",
    name: "V Dynamite",
    member: "V",
    era: "Dynamite",
    rarity: "epic",
    rarity_points: 8,
    image_url: "https://example.com/v.jpg",
  },
  seller: {
    id: "seller-1",
    name: "Army Fan",
    avatar: "https://example.com/avatar.jpg",
  },
};

const MOCK_OFFER: TradeOffer = {
  id: "offer-1",
  listing_id: "listing-1",
  buyer_id: "buyer-1",
  offered_card_id: "card-def-2",
  status: "pending",
  created_at: "2026-04-23T00:00:00Z",
  resolved_at: null,
};

const MOCK_USER_CARD: UserCard = {
  user_id: "user-1",
  card_definition_id: "card-def-1",
  quantity: 3,
  locked_quantity: 1,
  first_obtained_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

describe("useMarketListings", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  it("hace GET a /api/market/listings sin filtros", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ listings: [MOCK_LISTING], next_cursor: null }),
    });

    const { useMarketListings } = await import("@/hooks/useMarket");
    renderHook(() => useMarketListings(), { wrapper: wrapper(queryClient) });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/market/listings")
      );
    });
  });

  it("pasa filtros como query params cuando se proveen", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ listings: [], next_cursor: null }),
    });

    const { useMarketListings } = await import("@/hooks/useMarket");
    renderHook(() => useMarketListings({ rarity: "epic" }), {
      wrapper: wrapper(queryClient),
    });

    await waitFor(() => {
      const url = (mockFetch.mock.calls[0] as string[])[0];
      expect(url).toContain("rarity=epic");
    });
  });

  it("queryKey incluye filtros para invalidaciones selectivas", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ listings: [MOCK_LISTING], next_cursor: null }),
    });

    const { useMarketListings } = await import("@/hooks/useMarket");
    const filters = { rarity: "rare" as const };
    renderHook(() => useMarketListings(filters), { wrapper: wrapper(queryClient) });

    await waitFor(() => {
      const state = queryClient.getQueryState(["market", "listings", filters]);
      expect(state).toBeDefined();
    });
  });

  it("retorna listings con datos de card y seller", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ listings: [MOCK_LISTING], next_cursor: null }),
    });

    const { useMarketListings } = await import("@/hooks/useMarket");
    const { result } = renderHook(() => useMarketListings(), {
      wrapper: wrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.listings[0].cards?.name).toBe("V Dynamite");
  });
});

describe("useListing", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  it("hace GET a /api/market/listings/[id]", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ listing: MOCK_LISTING }),
    });

    const { useListing } = await import("@/hooks/useMarket");
    renderHook(() => useListing("listing-1"), { wrapper: wrapper(queryClient) });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/market/listings/listing-1");
    });
  });

  it("queryKey es ['market', 'listing', id]", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ listing: MOCK_LISTING }),
    });

    const { useListing } = await import("@/hooks/useMarket");
    renderHook(() => useListing("listing-1"), { wrapper: wrapper(queryClient) });

    await waitFor(() => {
      const state = queryClient.getQueryState(["market", "listing", "listing-1"]);
      expect(state).toBeDefined();
    });
  });

  it("no hace fetch si id está vacío", async () => {
    const { useListing } = await import("@/hooks/useMarket");
    renderHook(() => useListing(""), { wrapper: wrapper(queryClient) });

    // Dar tiempo para ver si hace fetch
    await new Promise((r) => setTimeout(r, 50));
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("useListingOffers", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  it("hace GET a /api/market/listings/[listingId]/offers", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ offers: [MOCK_OFFER] }),
    });

    const { useListingOffers } = await import("@/hooks/useMarket");
    renderHook(() => useListingOffers("listing-1"), { wrapper: wrapper(queryClient) });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/market/listings/listing-1/offers"
      );
    });
  });

  it("queryKey es ['market', 'listing', listingId, 'offers']", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ offers: [MOCK_OFFER] }),
    });

    const { useListingOffers } = await import("@/hooks/useMarket");
    renderHook(() => useListingOffers("listing-1"), { wrapper: wrapper(queryClient) });

    await waitFor(() => {
      const state = queryClient.getQueryState([
        "market",
        "listing",
        "listing-1",
        "offers",
      ]);
      expect(state).toBeDefined();
    });
  });

  it("retorna TradeOffer[]", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ offers: [MOCK_OFFER] }),
    });

    const { useListingOffers } = await import("@/hooks/useMarket");
    const { result } = renderHook(() => useListingOffers("listing-1"), {
      wrapper: wrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([MOCK_OFFER]);
  });
});

describe("useCreateListing", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  it("hace POST a /api/market/listings con el payload correcto", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 201,
      json: () => Promise.resolve({ listing: MOCK_LISTING }),
    });

    const { useCreateListing } = await import("@/hooks/useMarket");
    const { result } = renderHook(() => useCreateListing(), {
      wrapper: wrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        card_definition_id: "card-def-1",
        auto_accept: false,
      });
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/market/listings",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "Content-Type": "application/json" }),
        body: JSON.stringify({ card_definition_id: "card-def-1", auto_accept: false }),
      })
    );
  });

  it("invalida ['inventory'] y ['market', 'listings'] en onSuccess", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 201,
      json: () => Promise.resolve({ listing: MOCK_LISTING }),
    });

    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { useCreateListing } = await import("@/hooks/useMarket");
    const { result } = renderHook(() => useCreateListing(), {
      wrapper: wrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        card_definition_id: "card-def-1",
        auto_accept: false,
      });
    });

    const invalidatedKeys = invalidateSpy.mock.calls.map(
      ([opts]) => (opts as { queryKey: unknown[] }).queryKey
    );

    expect(
      invalidatedKeys.some((k) => JSON.stringify(k) === JSON.stringify(["inventory"]))
    ).toBe(true);
    expect(
      invalidatedKeys.some(
        (k) =>
          Array.isArray(k) &&
          k[0] === "market" &&
          k[1] === "listings"
      )
    ).toBe(true);
  });

  it("invalida ['market', 'my-listings'] en onSuccess", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 201,
      json: () => Promise.resolve({ listing: MOCK_LISTING }),
    });

    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { useCreateListing } = await import("@/hooks/useMarket");
    const { result } = renderHook(() => useCreateListing(), {
      wrapper: wrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        card_definition_id: "card-def-1",
        auto_accept: false,
      });
    });

    const invalidatedKeys = invalidateSpy.mock.calls.map(
      ([opts]) => (opts as { queryKey: unknown[] }).queryKey
    );

    expect(
      invalidatedKeys.some(
        (k) =>
          Array.isArray(k) &&
          k[0] === "market" &&
          k[1] === "my-listings"
      )
    ).toBe(true);
  });

  it("aplica optimistic update decrementando quantity en inventory", async () => {
    // Pre-populate inventory cache
    queryClient.setQueryData(["inventory"], [MOCK_USER_CARD]);

    mockFetch.mockResolvedValue({
      ok: true,
      status: 201,
      json: () => Promise.resolve({ listing: MOCK_LISTING }),
    });

    const { useCreateListing } = await import("@/hooks/useMarket");
    const { result } = renderHook(() => useCreateListing(), {
      wrapper: wrapper(queryClient),
    });

    // Iniciar mutación sin esperar resolución completa para ver el optimistic
    act(() => {
      result.current.mutate({
        card_definition_id: "card-def-1",
        auto_accept: false,
      });
    });

    // El optimistic update debería haber decrementado quantity
    await waitFor(() => {
      const cached = queryClient.getQueryData<UserCard[]>(["inventory"]);
      const card = cached?.find((c) => c.card_definition_id === "card-def-1");
      // quantity original era 3, post-optimistic debería ser 2
      expect(card?.quantity).toBe(2);
    });
  });

  it("hace rollback del optimistic update en caso de error", async () => {
    queryClient.setQueryData(["inventory"], [MOCK_USER_CARD]);

    mockFetch.mockResolvedValue({
      ok: false,
      status: 422,
      json: () =>
        Promise.resolve({ error: "available_quantity_insufficient" }),
    });

    const { useCreateListing } = await import("@/hooks/useMarket");
    const { result } = renderHook(() => useCreateListing(), {
      wrapper: wrapper(queryClient),
    });

    await act(async () => {
      try {
        await result.current.mutateAsync({
          card_definition_id: "card-def-1",
          auto_accept: false,
        });
      } catch {
        // error esperado
      }
    });

    // La cache debe volver al estado original (quantity = 3)
    const cached = queryClient.getQueryData<UserCard[]>(["inventory"]);
    const card = cached?.find((c) => c.card_definition_id === "card-def-1");
    expect(card?.quantity).toBe(3);
  });

  it("lanza error cuando la API responde con error", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 422,
      json: () =>
        Promise.resolve({ error: "duplicate_active_listing" }),
    });

    const { useCreateListing } = await import("@/hooks/useMarket");
    const { result } = renderHook(() => useCreateListing(), {
      wrapper: wrapper(queryClient),
    });

    await expect(
      act(async () => {
        await result.current.mutateAsync({
          card_definition_id: "card-def-1",
          auto_accept: false,
        });
      })
    ).rejects.toThrow();
  });
});

describe("useCancelListing", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  it("hace DELETE a /api/market/listings/[id]", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ ok: true }),
    });

    const { useCancelListing } = await import("@/hooks/useMarket");
    const { result } = renderHook(() => useCancelListing(), {
      wrapper: wrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({ id: "listing-1" });
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/market/listings/listing-1",
      expect.objectContaining({ method: "DELETE" })
    );
  });

  it("invalida ['inventory'], ['market', 'my-listings'] y ['market', 'listing', id] en onSuccess", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ ok: true }),
    });

    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { useCancelListing } = await import("@/hooks/useMarket");
    const { result } = renderHook(() => useCancelListing(), {
      wrapper: wrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({ id: "listing-1" });
    });

    const invalidatedKeys = invalidateSpy.mock.calls.map(
      ([opts]) => (opts as { queryKey: unknown[] }).queryKey
    );

    expect(
      invalidatedKeys.some((k) => JSON.stringify(k) === JSON.stringify(["inventory"]))
    ).toBe(true);
    expect(
      invalidatedKeys.some(
        (k) =>
          Array.isArray(k) &&
          k[0] === "market" &&
          k[1] === "my-listings"
      )
    ).toBe(true);
    expect(
      invalidatedKeys.some(
        (k) =>
          Array.isArray(k) &&
          k[0] === "market" &&
          k[1] === "listing" &&
          k[2] === "listing-1"
      )
    ).toBe(true);
  });
});

describe("useCreateOffer", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  it("hace POST a /api/market/listings/[listingId]/offers con payload correcto", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 201,
      json: () => Promise.resolve({ offer: MOCK_OFFER }),
    });

    const { useCreateOffer } = await import("@/hooks/useMarket");
    const { result } = renderHook(() => useCreateOffer(), {
      wrapper: wrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        listingId: "listing-1",
        offered_card_id: "card-def-2",
      });
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/market/listings/listing-1/offers",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ offered_card_id: "card-def-2" }),
      })
    );
  });

  it("invalida ['inventory'] y ['market', 'listing', listingId, 'offers'] en onSuccess", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 201,
      json: () => Promise.resolve({ offer: MOCK_OFFER }),
    });

    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { useCreateOffer } = await import("@/hooks/useMarket");
    const { result } = renderHook(() => useCreateOffer(), {
      wrapper: wrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        listingId: "listing-1",
        offered_card_id: "card-def-2",
      });
    });

    const invalidatedKeys = invalidateSpy.mock.calls.map(
      ([opts]) => (opts as { queryKey: unknown[] }).queryKey
    );

    expect(
      invalidatedKeys.some((k) => JSON.stringify(k) === JSON.stringify(["inventory"]))
    ).toBe(true);
    expect(
      invalidatedKeys.some(
        (k) =>
          Array.isArray(k) &&
          k[0] === "market" &&
          k[1] === "listing" &&
          k[2] === "listing-1" &&
          k[3] === "offers"
      )
    ).toBe(true);
  });

  it("aplica optimistic update incrementando locked_quantity en inventory", async () => {
    queryClient.setQueryData(["inventory"], [MOCK_USER_CARD]);

    mockFetch.mockResolvedValue({
      ok: true,
      status: 201,
      json: () => Promise.resolve({ offer: MOCK_OFFER }),
    });

    const { useCreateOffer } = await import("@/hooks/useMarket");
    const { result } = renderHook(() => useCreateOffer(), {
      wrapper: wrapper(queryClient),
    });

    act(() => {
      result.current.mutate({
        listingId: "listing-1",
        offered_card_id: "card-def-1",
      });
    });

    await waitFor(() => {
      const cached = queryClient.getQueryData<UserCard[]>(["inventory"]);
      const card = cached?.find((c) => c.card_definition_id === "card-def-1");
      // locked_quantity original era 1, post-optimistic debería ser 2
      expect(card?.locked_quantity).toBe(2);
    });
  });
});

describe("useAcceptOffer", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  it("hace POST a /api/market/listings/[listingId]/offers/[offerId]/accept", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ ok: true, trade_id: "listing-1" }),
    });

    const { useAcceptOffer } = await import("@/hooks/useMarket");
    const { result } = renderHook(() => useAcceptOffer(), {
      wrapper: wrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        listingId: "listing-1",
        offerId: "offer-1",
      });
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/market/listings/listing-1/offers/offer-1/accept",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("invalida ['market'] completo, ['inventory'] y ['trade-history'] en onSuccess", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ ok: true, trade_id: "listing-1" }),
    });

    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { useAcceptOffer } = await import("@/hooks/useMarket");
    const { result } = renderHook(() => useAcceptOffer(), {
      wrapper: wrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        listingId: "listing-1",
        offerId: "offer-1",
      });
    });

    const invalidatedKeys = invalidateSpy.mock.calls.map(
      ([opts]) => (opts as { queryKey: unknown[] }).queryKey
    );

    // Invalida todo market
    expect(
      invalidatedKeys.some((k) => Array.isArray(k) && k[0] === "market")
    ).toBe(true);

    // Invalida inventory
    expect(
      invalidatedKeys.some((k) => JSON.stringify(k) === JSON.stringify(["inventory"]))
    ).toBe(true);

    // Invalida trade-history
    expect(
      invalidatedKeys.some((k) => Array.isArray(k) && k[0] === "trade-history")
    ).toBe(true);
  });

  it("lanza error cuando la API responde 422", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 422,
      json: () => Promise.resolve({ error: "offer_invalid" }),
    });

    const { useAcceptOffer } = await import("@/hooks/useMarket");
    const { result } = renderHook(() => useAcceptOffer(), {
      wrapper: wrapper(queryClient),
    });

    await expect(
      act(async () => {
        await result.current.mutateAsync({
          listingId: "listing-1",
          offerId: "offer-1",
        });
      })
    ).rejects.toThrow();
  });
});

describe("useCancelOffer", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  it("hace DELETE a /api/market/listings/[listingId]/offers/[offerId]", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ ok: true }),
    });

    const { useCancelOffer } = await import("@/hooks/useMarket");
    const { result } = renderHook(() => useCancelOffer(), {
      wrapper: wrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        listingId: "listing-1",
        offerId: "offer-1",
      });
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/market/listings/listing-1/offers/offer-1",
      expect.objectContaining({ method: "DELETE" })
    );
  });

  it("invalida ['inventory'] y offers del listing en onSuccess", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ ok: true }),
    });

    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { useCancelOffer } = await import("@/hooks/useMarket");
    const { result } = renderHook(() => useCancelOffer(), {
      wrapper: wrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        listingId: "listing-1",
        offerId: "offer-1",
      });
    });

    const invalidatedKeys = invalidateSpy.mock.calls.map(
      ([opts]) => (opts as { queryKey: unknown[] }).queryKey
    );

    expect(
      invalidatedKeys.some((k) => JSON.stringify(k) === JSON.stringify(["inventory"]))
    ).toBe(true);
    expect(
      invalidatedKeys.some(
        (k) =>
          Array.isArray(k) &&
          k[0] === "market" &&
          k[1] === "listing" &&
          k[2] === "listing-1" &&
          k[3] === "offers"
      )
    ).toBe(true);
  });
});
