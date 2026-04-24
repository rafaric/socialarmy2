import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ getAll: () => [], set: vi.fn() }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

const mockRpcResult = vi.fn();
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    rpc: mockRpcResult,
  })),
}));

const VALID_SECRET = "test-cron-secret-value";

function makeRequest(secret?: string): NextRequest {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (secret !== undefined) headers["x-cron-secret"] = secret;
  return new NextRequest("http://localhost/api/market/expire", {
    method: "POST",
    headers,
  });
}

describe("POST /api/market/expire", () => {
  beforeEach(() => {
    vi.resetModules();
    mockRpcResult.mockReset();
    vi.stubEnv("CRON_SECRET", VALID_SECRET);
  });

  it("responde 401 si no hay header x-cron-secret", async () => {
    const { POST } = await import("@/app/api/market/expire/route");
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
  });

  it("responde 401 si el secret es inválido", async () => {
    const { POST } = await import("@/app/api/market/expire/route");
    const res = await POST(makeRequest("wrong-secret"));
    expect(res.status).toBe(401);
  });

  it("responde 200 con processed y errors en happy path", async () => {
    mockRpcResult.mockResolvedValue({
      data: [{ processed: 5, errors: 0 }],
      error: null,
    });
    const { POST } = await import("@/app/api/market/expire/route");
    const res = await POST(makeRequest(VALID_SECRET));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("processed");
    expect(body).toHaveProperty("errors");
  });

  it("responde 200 con processed:0 errors:0 si no hay listings expirados (idempotencia)", async () => {
    mockRpcResult.mockResolvedValue({
      data: [{ processed: 0, errors: 0 }],
      error: null,
    });
    const { POST } = await import("@/app/api/market/expire/route");
    const res = await POST(makeRequest(VALID_SECRET));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.processed).toBe(0);
    expect(body.errors).toBe(0);
  });
});
