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
const LISTING_ID = "dddddddd-0000-0000-0000-000000000001";

function makeRequest(id: string): NextRequest {
  return new NextRequest(`http://localhost/api/market/listings/${id}`, { method: "DELETE" });
}

describe("DELETE /api/market/listings/[id]", () => {
  beforeEach(() => {
    vi.resetModules();
    mockAdminFrom.mockReset();
    mockRpcResult.mockReset();
  });

  it("responde 401 sin autenticación", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const { DELETE } = await import("@/app/api/market/listings/[id]/route");
    const res = await DELETE(makeRequest(LISTING_ID), { params: Promise.resolve({ id: LISTING_ID }) });
    expect(res.status).toBe(401);
  });

  it("responde 400 si el id no es UUID válido", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
    const { DELETE } = await import("@/app/api/market/listings/[id]/route");
    const res = await DELETE(makeRequest("not-uuid"), { params: Promise.resolve({ id: "not-uuid" }) });
    expect(res.status).toBe(400);
  });

  it("responde 403 si el user no es el seller", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
    mockRpcResult.mockResolvedValue({
      data: { ok: false, error: "forbidden" },
      error: null,
    });
    const { DELETE } = await import("@/app/api/market/listings/[id]/route");
    const res = await DELETE(makeRequest(LISTING_ID), { params: Promise.resolve({ id: LISTING_ID }) });
    expect(res.status).toBe(403);
  });

  it("responde 409 si el listing no es cancellable (status != active)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
    mockRpcResult.mockResolvedValue({
      data: { ok: false, error: "listing_not_cancellable" },
      error: null,
    });
    const { DELETE } = await import("@/app/api/market/listings/[id]/route");
    const res = await DELETE(makeRequest(LISTING_ID), { params: Promise.resolve({ id: LISTING_ID }) });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("listing_not_cancellable");
  });

  it("responde 200 con { ok: true } en happy path", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
    mockRpcResult.mockResolvedValue({
      data: { ok: true },
      error: null,
    });
    const { DELETE } = await import("@/app/api/market/listings/[id]/route");
    const res = await DELETE(makeRequest(LISTING_ID), { params: Promise.resolve({ id: LISTING_ID }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
  });
});
