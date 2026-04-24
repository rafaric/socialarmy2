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

const BUYER_ID = "bbbbbbbb-0000-0000-0000-000000000002";
const LISTING_ID = "dddddddd-0000-0000-0000-000000000001";
const OFFER_ID = "eeeeeeee-0000-0000-0000-000000000001";

function makeRequest(listingId: string, offerId: string): NextRequest {
  return new NextRequest(
    `http://localhost/api/market/listings/${listingId}/offers/${offerId}`,
    { method: "DELETE" }
  );
}

const params = { id: LISTING_ID, offerId: OFFER_ID };

describe("DELETE /api/market/listings/[id]/offers/[offerId]", () => {
  beforeEach(() => {
    vi.resetModules();
    mockAdminFrom.mockReset();
    mockRpcResult.mockReset();
  });

  it("responde 401 sin autenticación", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const { DELETE } = await import("@/app/api/market/listings/[id]/offers/[offerId]/route");
    const res = await DELETE(makeRequest(LISTING_ID, OFFER_ID), { params: Promise.resolve(params) });
    expect(res.status).toBe(401);
  });

  it("responde 400 si offerId no es UUID válido", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: BUYER_ID } } });
    const { DELETE } = await import("@/app/api/market/listings/[id]/offers/[offerId]/route");
    const res = await DELETE(makeRequest(LISTING_ID, "bad-id"), {
      params: Promise.resolve({ id: LISTING_ID, offerId: "bad-id" }),
    });
    expect(res.status).toBe(400);
  });

  it("responde 409 si la oferta no está en estado pending (offer_not_cancellable)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: BUYER_ID } } });
    mockRpcResult.mockResolvedValue({
      data: { ok: false, error: "offer_not_cancellable" },
      error: null,
    });
    const { DELETE } = await import("@/app/api/market/listings/[id]/offers/[offerId]/route");
    const res = await DELETE(makeRequest(LISTING_ID, OFFER_ID), { params: Promise.resolve(params) });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("offer_not_cancellable");
  });

  it("responde 403 si el user no es el buyer de la oferta", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: BUYER_ID } } });
    mockRpcResult.mockResolvedValue({
      data: { ok: false, error: "forbidden" },
      error: null,
    });
    const { DELETE } = await import("@/app/api/market/listings/[id]/offers/[offerId]/route");
    const res = await DELETE(makeRequest(LISTING_ID, OFFER_ID), { params: Promise.resolve(params) });
    expect(res.status).toBe(403);
  });

  it("responde 200 con { ok: true } en happy path", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: BUYER_ID } } });
    mockRpcResult.mockResolvedValue({
      data: { ok: true },
      error: null,
    });
    const { DELETE } = await import("@/app/api/market/listings/[id]/offers/[offerId]/route");
    const res = await DELETE(makeRequest(LISTING_ID, OFFER_ID), { params: Promise.resolve(params) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
  });
});
