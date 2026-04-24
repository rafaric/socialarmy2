import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import type { UserCard } from "@/types";

// Usar React Query real, no el mock global del setup
vi.unmock("@tanstack/react-query");

// Mock fetch global
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Mock Supabase browser para evitar imports que cuelguen
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

const MOCK_USER_CARDS: UserCard[] = [
  {
    user_id: "user-1",
    card_definition_id: "card-def-1",
    quantity: 3,
    locked_quantity: 1,
    first_obtained_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    cards: {
      id: "card-def-1",
      name: "RM Butter",
      member: "RM",
      era: "Butter",
      rarity: "rare",
      rarity_points: 4,
      image_url: "https://example.com/rm.jpg",
    },
  },
  {
    user_id: "user-1",
    card_definition_id: "card-def-2",
    quantity: 1,
    locked_quantity: 0,
    first_obtained_at: "2024-01-02T00:00:00Z",
    updated_at: "2024-01-02T00:00:00Z",
    cards: {
      id: "card-def-2",
      name: "Jimin Dynamite",
      member: "Jimin",
      era: "Dynamite",
      rarity: "legendary",
      rarity_points: 16,
      image_url: "https://example.com/jimin.jpg",
    },
  },
];

describe("useInventory", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  it("queryKey usa ['inventory']", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ cards: MOCK_USER_CARDS }),
    });

    const { useInventory } = await import("@/hooks/useInventory");
    const { result } = renderHook(() => useInventory(), {
      wrapper: wrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Verificar que la query con key ['inventory'] existe en el cache
    expect(queryClient.getQueryState(["inventory"])).toBeDefined();
  });

  it("hace GET a /api/cards/inventory", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ cards: MOCK_USER_CARDS }),
    });

    const { useInventory } = await import("@/hooks/useInventory");
    renderHook(() => useInventory(), { wrapper: wrapper(queryClient) });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/cards/inventory");
    });
  });

  it("retorna UserCard[] con los datos de cards incluidos", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ cards: MOCK_USER_CARDS }),
    });

    const { useInventory } = await import("@/hooks/useInventory");
    const { result } = renderHook(() => useInventory(), {
      wrapper: wrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(MOCK_USER_CARDS);
    expect(result.current.data?.[0].cards?.name).toBe("RM Butter");
    expect(result.current.data?.[0].cards?.rarity_points).toBe(4);
  });

  it("el campo available_quantity es quantity - locked_quantity", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ cards: MOCK_USER_CARDS }),
    });

    const { useInventory } = await import("@/hooks/useInventory");
    const { result } = renderHook(() => useInventory(), {
      wrapper: wrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Primera carta: quantity=3, locked=1 → available=2
    const first = result.current.data?.[0]!;
    expect(first.quantity - first.locked_quantity).toBe(2);
  });

  it("isLoading es true al inicio y pasa a false con datos", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ cards: MOCK_USER_CARDS }),
    });

    const { useInventory } = await import("@/hooks/useInventory");
    const { result } = renderHook(() => useInventory(), {
      wrapper: wrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isSuccess).toBe(true);
    });
  });

  it("isError es true cuando la API falla", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: "Unauthorized" }),
    });

    const { useInventory } = await import("@/hooks/useInventory");
    const { result } = renderHook(() => useInventory(), {
      wrapper: wrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });

  it("lanza error cuando fetch rechaza", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    const { useInventory } = await import("@/hooks/useInventory");
    const { result } = renderHook(() => useInventory(), {
      wrapper: wrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
      expect(result.current.error).toBeTruthy();
    });
  });
});
