import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import type { WishlistItem } from "@/types";

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

const MOCK_WISHLIST_ITEMS: WishlistItem[] = [
  {
    user_id: "user-1",
    card_definition_id: "card-def-1",
    created_at: "2026-04-23T00:00:00Z",
    cards: {
      id: "card-def-1",
      name: "Jin Yet To Come",
      member: "Jin",
      era: "Yet To Come",
      rarity: "legendary",
      rarity_points: 16,
      image_url: "https://example.com/jin.jpg",
    },
  },
  {
    user_id: "user-1",
    card_definition_id: "card-def-2",
    created_at: "2026-04-22T00:00:00Z",
    cards: {
      id: "card-def-2",
      name: "Jungkook Butter",
      member: "Jungkook",
      era: "Butter",
      rarity: "epic",
      rarity_points: 8,
      image_url: "https://example.com/jk.jpg",
    },
  },
];

describe("useWishlist", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  it("hace GET a /api/wishlist", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ items: MOCK_WISHLIST_ITEMS }),
    });

    const { useWishlist } = await import("@/hooks/useWishlist");
    renderHook(() => useWishlist(), { wrapper: wrapper(queryClient) });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/wishlist");
    });
  });

  it("queryKey es ['wishlist']", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ items: MOCK_WISHLIST_ITEMS }),
    });

    const { useWishlist } = await import("@/hooks/useWishlist");
    renderHook(() => useWishlist(), { wrapper: wrapper(queryClient) });

    await waitFor(() => {
      const state = queryClient.getQueryState(["wishlist"]);
      expect(state).toBeDefined();
    });
  });

  it("retorna WishlistItem[] con datos de cards incluidos", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ items: MOCK_WISHLIST_ITEMS }),
    });

    const { useWishlist } = await import("@/hooks/useWishlist");
    const { result } = renderHook(() => useWishlist(), {
      wrapper: wrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(MOCK_WISHLIST_ITEMS);
    expect(result.current.data?.[0].cards?.name).toBe("Jin Yet To Come");
  });

  it("isError es true cuando la API falla", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: "Unauthorized" }),
    });

    const { useWishlist } = await import("@/hooks/useWishlist");
    const { result } = renderHook(() => useWishlist(), {
      wrapper: wrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});

describe("useToggleWishlist", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  it("hace POST cuando la carta NO está en wishlist", async () => {
    // Cache sin la carta
    queryClient.setQueryData(["wishlist"], []);

    mockFetch.mockResolvedValue({
      ok: true,
      status: 201,
      json: () =>
        Promise.resolve({
          item: {
            user_id: "user-1",
            card_definition_id: "card-def-1",
            created_at: "2026-04-23T00:00:00Z",
          },
        }),
    });

    const { useToggleWishlist } = await import("@/hooks/useWishlist");
    const { result } = renderHook(() => useToggleWishlist(), {
      wrapper: wrapper(queryClient),
    });

    // Pasar isInWishlist=false explícitamente para evitar race con onMutate
    await act(async () => {
      await result.current.mutateAsync({
        cardDefinitionId: "card-def-1",
        isInWishlist: false,
      });
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/wishlist",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ card_definition_id: "card-def-1" }),
      })
    );
  });

  it("hace DELETE cuando la carta YA está en wishlist", async () => {
    // Cache con la carta
    queryClient.setQueryData(["wishlist"], MOCK_WISHLIST_ITEMS);

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ ok: true }),
    });

    const { useToggleWishlist } = await import("@/hooks/useWishlist");
    const { result } = renderHook(() => useToggleWishlist(), {
      wrapper: wrapper(queryClient),
    });

    // Pasar isInWishlist=true explícitamente para evitar race con onMutate
    await act(async () => {
      await result.current.mutateAsync({
        cardDefinitionId: "card-def-1",
        isInWishlist: true,
      });
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/wishlist/card-def-1",
      expect.objectContaining({ method: "DELETE" })
    );
  });

  it("aplica optimistic update: agrega item al cache antes de resolver", async () => {
    queryClient.setQueryData(["wishlist"], []);

    // Fetch que tarda para dar tiempo de ver el estado optimistic
    mockFetch.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                status: 201,
                json: () =>
                  Promise.resolve({
                    item: {
                      user_id: "user-1",
                      card_definition_id: "card-def-new",
                      created_at: "2026-04-23T00:00:00Z",
                    },
                  }),
              }),
            50
          )
        )
    );

    const { useToggleWishlist } = await import("@/hooks/useWishlist");
    const { result } = renderHook(() => useToggleWishlist(), {
      wrapper: wrapper(queryClient),
    });

    act(() => {
      // isInWishlist=false: la carta no está en cache (cache está vacío)
      result.current.mutate({ cardDefinitionId: "card-def-new", isInWishlist: false });
    });

    // El optimistic update debería haberse aplicado antes de que fetch resuelva
    await waitFor(() => {
      const cached = queryClient.getQueryData<WishlistItem[]>(["wishlist"]);
      expect(
        cached?.some((item) => item.card_definition_id === "card-def-new")
      ).toBe(true);
    });
  });

  it("aplica optimistic update: quita item del cache al hacer toggle-off", async () => {
    queryClient.setQueryData(["wishlist"], MOCK_WISHLIST_ITEMS);

    mockFetch.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                status: 200,
                json: () => Promise.resolve({ ok: true }),
              }),
            50
          )
        )
    );

    const { useToggleWishlist } = await import("@/hooks/useWishlist");
    const { result } = renderHook(() => useToggleWishlist(), {
      wrapper: wrapper(queryClient),
    });

    act(() => {
      // isInWishlist=true: la carta ESTÁ en el cache
      result.current.mutate({ cardDefinitionId: "card-def-1", isInWishlist: true });
    });

    // El optimistic update debería haber removido el item
    await waitFor(() => {
      const cached = queryClient.getQueryData<WishlistItem[]>(["wishlist"]);
      expect(
        cached?.some((item) => item.card_definition_id === "card-def-1")
      ).toBe(false);
    });
  });

  it("hace rollback si el toggle-add falla", async () => {
    queryClient.setQueryData(["wishlist"], []);

    mockFetch.mockResolvedValue({
      ok: false,
      status: 409,
      json: () => Promise.resolve({ error: "already_in_wishlist" }),
    });

    const { useToggleWishlist } = await import("@/hooks/useWishlist");
    const { result } = renderHook(() => useToggleWishlist(), {
      wrapper: wrapper(queryClient),
    });

    await act(async () => {
      try {
        await result.current.mutateAsync({
          cardDefinitionId: "card-def-1",
          isInWishlist: false,
        });
      } catch {
        // error esperado
      }
    });

    // La cache debe volver al estado original (vacía)
    const cached = queryClient.getQueryData<WishlistItem[]>(["wishlist"]);
    expect(cached?.length).toBe(0);
  });

  it("invalida ['wishlist'] en onSuccess", async () => {
    queryClient.setQueryData(["wishlist"], []);

    mockFetch.mockResolvedValue({
      ok: true,
      status: 201,
      json: () =>
        Promise.resolve({
          item: {
            user_id: "user-1",
            card_definition_id: "card-def-1",
            created_at: "2026-04-23T00:00:00Z",
          },
        }),
    });

    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { useToggleWishlist } = await import("@/hooks/useWishlist");
    const { result } = renderHook(() => useToggleWishlist(), {
      wrapper: wrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        cardDefinitionId: "card-def-1",
        isInWishlist: false,
      });
    });

    const invalidatedKeys = invalidateSpy.mock.calls.map(
      ([opts]) => (opts as { queryKey: unknown[] }).queryKey
    );

    expect(
      invalidatedKeys.some(
        (k) =>
          Array.isArray(k) && k[0] === "wishlist"
      )
    ).toBe(true);
  });
});

describe("useIsInWishlist", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  it("retorna true si el card_definition_id está en wishlist cache", async () => {
    queryClient.setQueryData(["wishlist"], MOCK_WISHLIST_ITEMS);

    const { useIsInWishlist } = await import("@/hooks/useWishlist");
    const { result } = renderHook(() => useIsInWishlist("card-def-1"), {
      wrapper: wrapper(queryClient),
    });

    expect(result.current).toBe(true);
  });

  it("retorna false si el card_definition_id NO está en wishlist cache", async () => {
    queryClient.setQueryData(["wishlist"], MOCK_WISHLIST_ITEMS);

    const { useIsInWishlist } = await import("@/hooks/useWishlist");
    const { result } = renderHook(() => useIsInWishlist("card-def-99"), {
      wrapper: wrapper(queryClient),
    });

    expect(result.current).toBe(false);
  });

  it("retorna false si el cache de wishlist está vacío", async () => {
    queryClient.setQueryData(["wishlist"], []);

    const { useIsInWishlist } = await import("@/hooks/useWishlist");
    const { result } = renderHook(() => useIsInWishlist("card-def-1"), {
      wrapper: wrapper(queryClient),
    });

    expect(result.current).toBe(false);
  });

  it("NO hace fetch adicional — solo lee del cache", async () => {
    queryClient.setQueryData(["wishlist"], MOCK_WISHLIST_ITEMS);

    const { useIsInWishlist } = await import("@/hooks/useWishlist");
    renderHook(() => useIsInWishlist("card-def-1"), {
      wrapper: wrapper(queryClient),
    });

    // Dar tiempo para ver si hace fetch
    await new Promise((r) => setTimeout(r, 50));
    // No debe haber fetch (useIsInWishlist solo lee del cache, no activa queryFn)
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
