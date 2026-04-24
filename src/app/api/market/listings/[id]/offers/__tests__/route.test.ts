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

const SELLER_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const BUYER_ID = "bbbbbbbb-0000-0000-0000-000000000002";
const LISTING_ID = "dddddddd-0000-0000-0000-000000000001";
const CARD_ID = "cccccccc-0000-0000-0000-000000000001";

function makeGetRequest(listingId: string): NextRequest {
  return new NextRequest(`http://localhost/api/market/listings/${listingId}/offers`, { method: "GET" });
}

function makePostRequest(listingId: string, body: unknown): NextRequest {
  const req = new NextRequest(`http://localhost/api/market/listings/${listingId}/offers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  vi.spyOn(req, "json").mockResolvedValue(body);
  return req;
}

const mockOffers = [
  {
    id: "eeeeeeee-0000-0000-0000-000000000001",
    listing_id: LISTING_ID,
    buyer_id: BUYER_ID,
    offered_card_id: CARD_ID,
    status: "pending",
    created_at: "2026-04-01T00:00:00Z",
    resolved_at: null,
  },
];

describe("GET /api/market/listings/[id]/offers", () => {
  beforeEach(() => {
    vi.resetModules();
    mockAdminFrom.mockReset();
    mockRpcResult.mockReset();
  });

  it("responde 401 sin autenticación", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const { GET } = await import("@/app/api/market/listings/[id]/offers/route");
    const res = await GET(makeGetRequest(LISTING_ID), { params: Promise.resolve({ id: LISTING_ID }) });
    expect(res.status).toBe(401);
  });

  it("responde 403 si el user no es el seller del listing", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: BUYER_ID } } });
    // Listing exists but seller is different
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "market_listings") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: LISTING_ID, seller_id: SELLER_ID },
            error: null,
          }),
        };
      }
      return { select: vi.fn().mockReturnThis() };
    });
    const { GET } = await import("@/app/api/market/listings/[id]/offers/route");
    const res = await GET(makeGetRequest(LISTING_ID), { params: Promise.resolve({ id: LISTING_ID }) });
    expect(res.status).toBe(403);
  });

  it("responde 200 con TradeOffer[] si el user es el seller", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: SELLER_ID } } });
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "market_listings") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: LISTING_ID, seller_id: SELLER_ID },
            error: null,
          }),
        };
      }
      if (table === "trade_offers") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: mockOffers, error: null }),
        };
      }
      return {};
    });
    const { GET } = await import("@/app/api/market/listings/[id]/offers/route");
    const res = await GET(makeGetRequest(LISTING_ID), { params: Promise.resolve({ id: LISTING_ID }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("offers");
    expect(Array.isArray(body.offers)).toBe(true);
  });
});

describe("POST /api/market/listings/[id]/offers", () => {
  beforeEach(() => {
    vi.resetModules();
    mockAdminFrom.mockReset();
    mockRpcResult.mockReset();
  });

  it("responde 401 sin autenticación", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const { POST } = await import("@/app/api/market/listings/[id]/offers/route");
    const req = makePostRequest(LISTING_ID, { offered_card_id: CARD_ID });
    const res = await POST(req, { params: Promise.resolve({ id: LISTING_ID }) });
    expect(res.status).toBe(401);
  });

  it("responde 400 si offered_card_id no es UUID válido", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: BUYER_ID } } });
    const { POST } = await import("@/app/api/market/listings/[id]/offers/route");
    const req = makePostRequest(LISTING_ID, { offered_card_id: "not-a-uuid" });
    const res = await POST(req, { params: Promise.resolve({ id: LISTING_ID }) });
    expect(res.status).toBe(400);
  });

  it("responde 422 si RPC retorna no_self_offer", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: SELLER_ID } } });
    mockRpcResult.mockResolvedValue({
      data: { ok: false, error: "no_self_offer" },
      error: null,
    });
    const { POST } = await import("@/app/api/market/listings/[id]/offers/route");
    const req = makePostRequest(LISTING_ID, { offered_card_id: CARD_ID });
    const res = await POST(req, { params: Promise.resolve({ id: LISTING_ID }) });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe("no_self_offer");
  });

  it("responde 422 si RPC retorna listing_not_active", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: BUYER_ID } } });
    mockRpcResult.mockResolvedValue({
      data: { ok: false, error: "listing_not_active" },
      error: null,
    });
    const { POST } = await import("@/app/api/market/listings/[id]/offers/route");
    const req = makePostRequest(LISTING_ID, { offered_card_id: CARD_ID });
    const res = await POST(req, { params: Promise.resolve({ id: LISTING_ID }) });
    expect(res.status).toBe(422);
  });

  it("responde 422 si RPC retorna insufficient_points", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: BUYER_ID } } });
    mockRpcResult.mockResolvedValue({
      data: { ok: false, error: "insufficient_points" },
      error: null,
    });
    const { POST } = await import("@/app/api/market/listings/[id]/offers/route");
    const req = makePostRequest(LISTING_ID, { offered_card_id: CARD_ID });
    const res = await POST(req, { params: Promise.resolve({ id: LISTING_ID }) });
    expect(res.status).toBe(422);
  });

  it("responde 422 si RPC retorna duplicate_pending_offer", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: BUYER_ID } } });
    mockRpcResult.mockResolvedValue({
      data: { ok: false, error: "duplicate_pending_offer" },
      error: null,
    });
    const { POST } = await import("@/app/api/market/listings/[id]/offers/route");
    const req = makePostRequest(LISTING_ID, { offered_card_id: CARD_ID });
    const res = await POST(req, { params: Promise.resolve({ id: LISTING_ID }) });
    expect(res.status).toBe(422);
  });

  it("responde 201 con offer en status pending en happy path", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: BUYER_ID } } });
    mockRpcResult.mockResolvedValue({
      data: { ok: true, offer: { ...mockOffers[0], status: "pending" } },
      error: null,
    });
    const { POST } = await import("@/app/api/market/listings/[id]/offers/route");
    const req = makePostRequest(LISTING_ID, { offered_card_id: CARD_ID });
    const res = await POST(req, { params: Promise.resolve({ id: LISTING_ID }) });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toHaveProperty("offer");
  });

  it("responde 201 con offer en status accepted si auto_accept", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: BUYER_ID } } });
    mockRpcResult.mockResolvedValue({
      data: { ok: true, offer: { ...mockOffers[0], status: "accepted" } },
      error: null,
    });
    const { POST } = await import("@/app/api/market/listings/[id]/offers/route");
    const req = makePostRequest(LISTING_ID, { offered_card_id: CARD_ID });
    const res = await POST(req, { params: Promise.resolve({ id: LISTING_ID }) });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.offer.status).toBe("accepted");
  });
});
