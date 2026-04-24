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

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost/api/cards/inventory", { method: "GET" });
}

const mockUserCards = [
  {
    user_id: USER_ID,
    card_definition_id: "cccccccc-0000-0000-0000-000000000001",
    quantity: 3,
    locked_quantity: 1,
    first_obtained_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-02T00:00:00Z",
    cards: {
      id: "cccccccc-0000-0000-0000-000000000001",
      name: "Jimin Dynamite",
      member: "Jimin",
      era: "BE",
      rarity: "epic",
      rarity_points: 8,
      image_url: "https://example.com/card.jpg",
    },
  },
];

function setupAdminMock(cards = mockUserCards) {
  mockAdminFrom.mockImplementation(() => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: cards, error: null }),
  }));
}

describe("GET /api/cards/inventory", () => {
  beforeEach(() => {
    vi.resetModules();
    mockAdminFrom.mockReset();
  });

  it("responde 401 sin autenticación", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const { GET } = await import("@/app/api/cards/inventory/route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("responde 200 con UserCard[] y campo available_quantity calculado", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
    setupAdminMock();
    const { GET } = await import("@/app/api/cards/inventory/route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("cards");
    expect(Array.isArray(body.cards)).toBe(true);
    expect(body.cards[0]).toHaveProperty("available_quantity", 2); // 3 - 1
  });

  it("retorna lista vacía si el usuario no tiene cartas", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
    setupAdminMock([]);
    const { GET } = await import("@/app/api/cards/inventory/route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.cards).toHaveLength(0);
  });

  it("responde 500 si Supabase retorna error", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
    mockAdminFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: null, error: { message: "DB error" } }),
    }));
    const { GET } = await import("@/app/api/cards/inventory/route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
  });
});
