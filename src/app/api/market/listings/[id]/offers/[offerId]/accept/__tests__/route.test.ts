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
const OFFER_ID = "eeeeeeee-0000-0000-0000-000000000001";

function makeRequest(listingId: string, offerId: string): NextRequest {
  return new NextRequest(
    `http://localhost/api/market/listings/${listingId}/offers/${offerId}/accept`,
    { method: "POST" }
  );
}

const params = { id: LISTING_ID, offerId: OFFER_ID };

describe("POST /api/market/listings/[id]/offers/[offerId]/accept", () => {
  beforeEach(() => {
    vi.resetModules();
    mockAdminFrom.mockReset();
    mockRpcResult.mockReset();
  });

  it("responde 401 sin autenticación", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const { POST } = await import("@/app/api/market/listings/[id]/offers/[offerId]/accept/route");
    const res = await POST(makeRequest(LISTING_ID, OFFER_ID), { params: Promise.resolve(params) });
    expect(res.status).toBe(401);
  });

  it("responde 400 si offerId no es UUID válido", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: SELLER_ID } } });
    const { POST } = await import("@/app/api/market/listings/[id]/offers/[offerId]/accept/route");
    const res = await POST(makeRequest(LISTING_ID, "bad-id"), {
      params: Promise.resolve({ id: LISTING_ID, offerId: "bad-id" }),
    });
    expect(res.status).toBe(400);
  });

  it("responde 403 si el user no es el seller del listing", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: BUYER_ID } } });
    mockAdminFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: LISTING_ID, seller_id: SELLER_ID },
        error: null,
      }),
    }));
    const { POST } = await import("@/app/api/market/listings/[id]/offers/[offerId]/accept/route");
    const res = await POST(makeRequest(LISTING_ID, OFFER_ID), { params: Promise.resolve(params) });
    expect(res.status).toBe(403);
  });

  it("responde 422 si RPC retorna listing_not_active", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: SELLER_ID } } });
    mockAdminFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: LISTING_ID, seller_id: SELLER_ID },
        error: null,
      }),
    }));
    mockRpcResult.mockResolvedValue({
      data: { ok: false, error: "listing_not_active" },
      error: null,
    });
    const { POST } = await import("@/app/api/market/listings/[id]/offers/[offerId]/accept/route");
    const res = await POST(makeRequest(LISTING_ID, OFFER_ID), { params: Promise.resolve(params) });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe("listing_not_active");
  });

  it("responde 422 si RPC retorna offer_invalid", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: SELLER_ID } } });
    mockAdminFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: LISTING_ID, seller_id: SELLER_ID },
        error: null,
      }),
    }));
    mockRpcResult.mockResolvedValue({
      data: { ok: false, error: "offer_invalid" },
      error: null,
    });
    const { POST } = await import("@/app/api/market/listings/[id]/offers/[offerId]/accept/route");
    const res = await POST(makeRequest(LISTING_ID, OFFER_ID), { params: Promise.resolve(params) });
    expect(res.status).toBe(422);
  });

  it("responde 200 con { ok: true, trade_id } en happy path", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: SELLER_ID } } });
    mockAdminFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: LISTING_ID, seller_id: SELLER_ID },
        error: null,
      }),
    }));
    mockRpcResult.mockResolvedValue({
      data: { ok: true, trade_id: LISTING_ID, offer_id: OFFER_ID },
      error: null,
    });
    const { POST } = await import("@/app/api/market/listings/[id]/offers/[offerId]/accept/route");
    const res = await POST(makeRequest(LISTING_ID, OFFER_ID), { params: Promise.resolve(params) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body).toHaveProperty("trade_id");
  });
});
