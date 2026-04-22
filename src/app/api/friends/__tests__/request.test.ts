import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock next/headers
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ getAll: () => [], set: vi.fn() }),
}));

// Mock Supabase server client (auth)
const mockGetUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
  }),
}));

// Mock Supabase admin client
const mockAdminFrom = vi.fn();
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ from: mockAdminFrom })),
}));

const CALLER_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const FRIEND_ID = "bbbbbbbb-0000-0000-0000-000000000002";

function makeRequest(body: unknown): NextRequest {
  const req = new NextRequest("http://localhost/api/friends/request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  vi.spyOn(req, "json").mockResolvedValue(body);
  return req;
}

/** Construye la cadena de mocks de admin client para un caso específico */
function setupAdminMock({
  existingFriend = null,
  existingBlock = null,
  insertFriendError = null,
  insertNotifError = null,
  deleteFriendError = null,
}: {
  existingFriend?: { status: string } | null;
  existingBlock?: { id: string } | null;
  insertFriendError?: { code?: string; message?: string } | null;
  insertNotifError?: { code?: string; message?: string } | null;
  deleteFriendError?: null;
} = {}) {
  mockAdminFrom.mockImplementation((table: string) => {
    if (table === "friends") {
      let callCount = 0;
      return {
        select: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockImplementation(() => {
          callCount++;
          // Primera llamada = dedup check, segunda = NO se usa en este flujo
          return Promise.resolve({ data: existingFriend, error: null });
        }),
        insert: vi.fn().mockResolvedValue({ data: null, error: insertFriendError }),
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
      };
    }
    if (table === "user_blocks" || table === "blocks") {
      return {
        select: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: existingBlock, error: null }),
      };
    }
    if (table === "notifications") {
      return {
        insert: vi.fn().mockResolvedValue({ data: null, error: insertNotifError }),
      };
    }
    return {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
  });
}

describe("POST /api/friends/request", () => {
  beforeEach(() => {
    vi.resetModules();
    mockAdminFrom.mockReset();
  });

  it("responde 401 sin autenticación", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const { POST } = await import("@/app/api/friends/request/route");
    const req = makeRequest({ friend_id: FRIEND_ID });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("responde 400 si friend_id no es un UUID válido", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: CALLER_ID } } });
    const { POST } = await import("@/app/api/friends/request/route");
    const req = makeRequest({ friend_id: "not-a-uuid" });
    setupAdminMock();
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("responde 400 si friend_id es igual al caller", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: CALLER_ID } } });
    const { POST } = await import("@/app/api/friends/request/route");
    const req = makeRequest({ friend_id: CALLER_ID });
    setupAdminMock();
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("yourself");
  });

  it("responde 409 si ya existe solicitud pending en dirección A→B", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: CALLER_ID } } });
    setupAdminMock({ existingFriend: { status: "pending" } });
    const { POST } = await import("@/app/api/friends/request/route");
    const req = makeRequest({ friend_id: FRIEND_ID });
    const res = await POST(req);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain("pending");
  });

  it("responde 409 si ya son amigos (status accepted)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: CALLER_ID } } });
    setupAdminMock({ existingFriend: { status: "accepted" } });
    const { POST } = await import("@/app/api/friends/request/route");
    const req = makeRequest({ friend_id: FRIEND_ID });
    const res = await POST(req);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain("friends");
  });

  it("responde 403 si existe bloqueo en cualquier dirección", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: CALLER_ID } } });
    setupAdminMock({ existingFriend: null, existingBlock: { id: "block-1" } });
    const { POST } = await import("@/app/api/friends/request/route");
    const req = makeRequest({ friend_id: FRIEND_ID });
    const res = await POST(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("Cannot send friend request");
  });

  it("responde 201 con requestId cuando todo OK", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: CALLER_ID } } });
    setupAdminMock({ existingFriend: null, existingBlock: null });
    const { POST } = await import("@/app/api/friends/request/route");
    const req = makeRequest({ friend_id: FRIEND_ID });
    const res = await POST(req);
    expect(res.status).toBe(201);
  });

  it("responde 409 si insert falla con código 23505 (unique violation / race condition)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: CALLER_ID } } });
    setupAdminMock({
      existingFriend: null,
      existingBlock: null,
      insertFriendError: { code: "23505", message: "duplicate key" },
    });
    const { POST } = await import("@/app/api/friends/request/route");
    const req = makeRequest({ friend_id: FRIEND_ID });
    const res = await POST(req);
    expect(res.status).toBe(409);
  });
});
