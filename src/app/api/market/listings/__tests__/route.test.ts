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

const mockRpcResult = vi.fn();
const mockAdminFrom = vi.fn();
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: mockAdminFrom,
    rpc: mockRpcResult,
  })),
}));

const USER_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const CARD_ID = "cccccccc-0000-0000-0000-000000000001";

function makeGetRequest(params = ""): NextRequest {
  return new NextRequest(`http://localhost/api/market/listings${params}`, { method: "GET" });
}

function makePostRequest(body: unknown): NextRequest {
  const req = new NextRequest("http://localhost/api/market/listings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  vi.spyOn(req, "json").mockResolvedValue(body);
  return req;
}

const mockListings = [
  {
    id: "dddddddd-0000-0000-0000-000000000001",
    seller_id: "bbbbbbbb-0000-0000-0000-000000000001",
    card_definition_id: CARD_ID,
    auto_accept: false,
    status: "active",
    expires_at: "2099-01-01T00:00:00Z",
    created_at: "2026-04-01T00:00:00Z",
    completed_at: null,
    cards: { id: CARD_ID, name: "Test Card", rarity: "epic", rarity_points: 8, image_url: "https://x.com/c.jpg" },
    seller: { id: "bbbbbbbb-0000-0000-0000-000000000001", name: "Seller", avatar: "https://x.com/a.jpg" },
  },
];

function setupGetListingsMock(listings = mockListings) {
  mockAdminFrom.mockImplementation(() => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: listings, error: null }),
  }));
}

describe("GET /api/market/listings", () => {
  beforeEach(() => {
    vi.resetModules();
    mockAdminFrom.mockReset();
    mockRpcResult.mockReset();
  });

  it("responde 401 sin autenticación", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const { GET } = await import("@/app/api/market/listings/route");
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(401);
  });

  it("responde 400 si limit es inválido (fuera de rango)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
    setupGetListingsMock();
    const { GET } = await import("@/app/api/market/listings/route");
    const res = await GET(makeGetRequest("?limit=100"));
    expect(res.status).toBe(400);
  });

  it("responde 400 si rarity es inválida", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
    setupGetListingsMock();
    const { GET } = await import("@/app/api/market/listings/route");
    const res = await GET(makeGetRequest("?rarity=supergod"));
    expect(res.status).toBe(400);
  });

  it("responde 400 si cursor no es ISO válido", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
    setupGetListingsMock();
    const { GET } = await import("@/app/api/market/listings/route");
    const res = await GET(makeGetRequest("?cursor=not-a-date"));
    expect(res.status).toBe(400);
  });

  it("responde 200 con listings y next_cursor", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
    setupGetListingsMock();
    const { GET } = await import("@/app/api/market/listings/route");
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("listings");
    expect(body).toHaveProperty("next_cursor");
    expect(Array.isArray(body.listings)).toBe(true);
  });

  it("retorna next_cursor null cuando hay menos items que el límite", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
    setupGetListingsMock(mockListings); // 1 item, default limit=20
    const { GET } = await import("@/app/api/market/listings/route");
    const res = await GET(makeGetRequest());
    const body = await res.json();
    expect(body.next_cursor).toBeNull();
  });
});

describe("POST /api/market/listings", () => {
  beforeEach(() => {
    vi.resetModules();
    mockAdminFrom.mockReset();
    mockRpcResult.mockReset();
  });

  it("responde 401 sin autenticación", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const { POST } = await import("@/app/api/market/listings/route");
    const req = makePostRequest({ card_definition_id: CARD_ID, auto_accept: false });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("responde 400 si card_definition_id no es UUID válido", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
    const { POST } = await import("@/app/api/market/listings/route");
    const req = makePostRequest({ card_definition_id: "not-a-uuid", auto_accept: false });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("responde 400 si auto_accept no es booleano", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
    const { POST } = await import("@/app/api/market/listings/route");
    const req = makePostRequest({ card_definition_id: CARD_ID, auto_accept: "yes" });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("responde 422 si RPC retorna available_quantity_insufficient", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
    mockRpcResult.mockResolvedValue({
      data: { ok: false, error: "available_quantity_insufficient" },
      error: null,
    });
    const { POST } = await import("@/app/api/market/listings/route");
    const req = makePostRequest({ card_definition_id: CARD_ID, auto_accept: false });
    const res = await POST(req);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe("available_quantity_insufficient");
  });

  it("responde 422 si RPC retorna duplicate_active_listing", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
    mockRpcResult.mockResolvedValue({
      data: { ok: false, error: "duplicate_active_listing" },
      error: null,
    });
    const { POST } = await import("@/app/api/market/listings/route");
    const req = makePostRequest({ card_definition_id: CARD_ID, auto_accept: false });
    const res = await POST(req);
    expect(res.status).toBe(422);
  });

  it("responde 201 con listing en happy path", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
    mockRpcResult.mockResolvedValue({
      data: { ok: true, listing: mockListings[0] },
      error: null,
    });
    const { POST } = await import("@/app/api/market/listings/route");
    const req = makePostRequest({ card_definition_id: CARD_ID, auto_accept: false });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toHaveProperty("listing");
  });
});
