import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ getAll: () => [], set: vi.fn() }),
}));

const mockGetUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
  }),
}));

const mockAdminFrom = vi.fn();
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ from: mockAdminFrom })),
}));

const USER_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const CARD_ID = "cccccccc-0000-0000-0000-000000000001";

function makeGetRequest(): NextRequest {
  return new NextRequest("http://localhost/api/wishlist", { method: "GET" });
}

function makePostRequest(body: unknown): NextRequest {
  const req = new NextRequest("http://localhost/api/wishlist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  vi.spyOn(req, "json").mockResolvedValue(body);
  return req;
}

const mockWishlistItems = [
  {
    user_id: USER_ID,
    card_definition_id: CARD_ID,
    created_at: "2026-04-01T00:00:00Z",
    cards: {
      id: CARD_ID,
      name: "Test Card",
      rarity: "epic",
      rarity_points: 8,
      image_url: "https://x.com/c.jpg",
    },
  },
];

describe("GET /api/wishlist", () => {
  beforeEach(() => {
    vi.resetModules();
    mockAdminFrom.mockReset();
  });

  it("responde 401 sin autenticación", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const { GET } = await import("@/app/api/wishlist/route");
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(401);
  });

  it("responde 200 con WishlistItem[] en happy path", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
    mockAdminFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: mockWishlistItems, error: null }),
    }));
    const { GET } = await import("@/app/api/wishlist/route");
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("items");
    expect(Array.isArray(body.items)).toBe(true);
  });
});

describe("POST /api/wishlist", () => {
  beforeEach(() => {
    vi.resetModules();
    mockAdminFrom.mockReset();
  });

  it("responde 401 sin autenticación", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const { POST } = await import("@/app/api/wishlist/route");
    const res = await POST(makePostRequest({ card_definition_id: CARD_ID }));
    expect(res.status).toBe(401);
  });

  it("responde 400 si card_definition_id no es UUID válido", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
    const { POST } = await import("@/app/api/wishlist/route");
    const res = await POST(makePostRequest({ card_definition_id: "not-a-uuid" }));
    expect(res.status).toBe(400);
  });

  it("responde 409 si la carta ya está en wishlist (already_in_wishlist)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
    mockAdminFrom.mockImplementation(() => ({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { code: "23505", message: "duplicate key" },
      }),
    }));
    const { POST } = await import("@/app/api/wishlist/route");
    const res = await POST(makePostRequest({ card_definition_id: CARD_ID }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("already_in_wishlist");
  });

  it("responde 201 con item en happy path", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
    mockAdminFrom.mockImplementation(() => ({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: mockWishlistItems[0],
        error: null,
      }),
    }));
    const { POST } = await import("@/app/api/wishlist/route");
    const res = await POST(makePostRequest({ card_definition_id: CARD_ID }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toHaveProperty("item");
  });
});
