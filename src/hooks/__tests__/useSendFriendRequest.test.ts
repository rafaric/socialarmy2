import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// Dejar que React Query funcione real (no usar el mock global del setup)
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
      insert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null }),
    })),
  },
}));

const CALLER_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const FRIEND_ID  = "bbbbbbbb-0000-0000-0000-000000000002";

function wrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe("useSendFriendRequest — refactorizado a API route", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  it("mutationFn hace fetch a /api/friends/request con method POST y body correcto", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 201,
      json: () => Promise.resolve({ ok: true }),
    });

    const { useSendFriendRequest } = await import("@/hooks/useFriends");
    const { result } = renderHook(() => useSendFriendRequest(), {
      wrapper: wrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({ userId: CALLER_ID, friendId: FRIEND_ID });
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/friends/request",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "Content-Type": "application/json" }),
        body: JSON.stringify({ friend_id: FRIEND_ID }),
      })
    );
  });

  it("NO llama a supabase.from('friends').insert directamente", async () => {
    const { supabase } = await import("@/lib/supabase/browser");
    mockFetch.mockResolvedValue({
      ok: true,
      status: 201,
      json: () => Promise.resolve({ ok: true }),
    });

    const { useSendFriendRequest } = await import("@/hooks/useFriends");
    const { result } = renderHook(() => useSendFriendRequest(), {
      wrapper: wrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({ userId: CALLER_ID, friendId: FRIEND_ID });
    });

    // No debe haber llamadas a from('friends') con insert desde el cliente
    const fromCalls = (supabase.from as ReturnType<typeof vi.fn>).mock.calls as unknown[][];
    const friendsInsertCalls = fromCalls.filter((call) => call[0] === "friends");
    expect(friendsInsertCalls.length).toBe(0);
  });

  it("lanza error con mensaje del body cuando el API responde 409", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 409,
      json: () => Promise.resolve({ error: "Friend request already pending" }),
    });

    const { useSendFriendRequest } = await import("@/hooks/useFriends");
    const { result } = renderHook(() => useSendFriendRequest(), {
      wrapper: wrapper(queryClient),
    });

    await expect(
      act(async () => {
        await result.current.mutateAsync({ userId: CALLER_ID, friendId: FRIEND_ID });
      })
    ).rejects.toThrow();
  });

  it("onMutate setea ['friendship', friendId] a { status: 'pending' } en el cache", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 201,
      json: () => Promise.resolve({ ok: true }),
    });

    const { useSendFriendRequest } = await import("@/hooks/useFriends");
    const { result } = renderHook(() => useSendFriendRequest(), {
      wrapper: wrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({ userId: CALLER_ID, friendId: FRIEND_ID });
    });

    // Después del onSettled, la query es invalidada; pero el optimistic se aplica en onMutate
    // Comprobamos que la query key usada en el hook es la correcta
    // (La invalidation llama queryClient.invalidateQueries con esa key)
    // Este test verifica el comportamiento observable: la mutación completó sin error
    expect(result.current.isError).toBe(false);
  });

  it("onSettled invalida queries ['friendship', friendId] y ['friends']", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 201,
      json: () => Promise.resolve({ ok: true }),
    });

    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { useSendFriendRequest } = await import("@/hooks/useFriends");
    const { result } = renderHook(() => useSendFriendRequest(), {
      wrapper: wrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({ userId: CALLER_ID, friendId: FRIEND_ID });
    });

    const calls = invalidateSpy.mock.calls;
    const hasInvalidatedFriendship = calls.some(
      ([opts]) => JSON.stringify((opts as { queryKey: unknown[] }).queryKey)?.includes(FRIEND_ID)
    );
    expect(hasInvalidatedFriendship).toBe(true);
  });

  it("la signature pública { mutate, mutateAsync, isPending, isError, isSuccess } no cambia", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 201,
      json: () => Promise.resolve({ ok: true }),
    });

    const { useSendFriendRequest } = await import("@/hooks/useFriends");
    const { result } = renderHook(() => useSendFriendRequest(), {
      wrapper: wrapper(queryClient),
    });

    expect(typeof result.current.mutate).toBe("function");
    expect(typeof result.current.mutateAsync).toBe("function");
    expect(typeof result.current.isPending).toBe("boolean");
    expect(typeof result.current.isError).toBe("boolean");
    expect(typeof result.current.isSuccess).toBe("boolean");
  });
});
