import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock para evitar llamadas reales a Supabase admin
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: { push_token: null }, error: null }),
        })),
      })),
    })),
  })),
}));

// Mock fetch global para push notifications externas
vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => ({}) }));

function makeRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/notifications/push", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

const VALID_PAYLOAD = {
  record: {
    user_receptor: "user-uuid-123",
    notification_type: "like",
    user_emisor: "user-uuid-456",
    post_id: "post-123",
  },
};

describe("POST /api/notifications/push — webhook secret verification", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("pasa la verificación cuando el header coincide con SUPABASE_WEBHOOK_SECRET", async () => {
    vi.stubEnv("SUPABASE_WEBHOOK_SECRET", "my-secret");
    const { POST } = await import("@/app/api/notifications/push/route");
    const req = makeRequest(VALID_PAYLOAD, { "x-webhook-secret": "my-secret" });
    const res = await POST(req as Parameters<typeof POST>[0]);
    expect(res.status).not.toBe(401);
  });

  it("responde 401 cuando el header x-webhook-secret está ausente", async () => {
    vi.stubEnv("SUPABASE_WEBHOOK_SECRET", "my-secret");
    const { POST } = await import("@/app/api/notifications/push/route");
    const req = makeRequest(VALID_PAYLOAD);
    const res = await POST(req as Parameters<typeof POST>[0]);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("responde 401 cuando el header tiene valor incorrecto", async () => {
    vi.stubEnv("SUPABASE_WEBHOOK_SECRET", "my-secret");
    const { POST } = await import("@/app/api/notifications/push/route");
    const req = makeRequest(VALID_PAYLOAD, { "x-webhook-secret": "wrong-secret" });
    const res = await POST(req as Parameters<typeof POST>[0]);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("emite console.warn y continúa si SUPABASE_WEBHOOK_SECRET no está definida", async () => {
    vi.stubEnv("SUPABASE_WEBHOOK_SECRET", "");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { POST } = await import("@/app/api/notifications/push/route");
    const req = makeRequest(VALID_PAYLOAD);
    const res = await POST(req as Parameters<typeof POST>[0]);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("SUPABASE_WEBHOOK_SECRET"));
    expect(res.status).not.toBe(401);
    warnSpy.mockRestore();
  });

  it("acepta requests que coincidan con SUPABASE_WEBHOOK_SECRET_PREVIOUS (rotación)", async () => {
    vi.stubEnv("SUPABASE_WEBHOOK_SECRET", "new-secret");
    vi.stubEnv("SUPABASE_WEBHOOK_SECRET_PREVIOUS", "old-secret");
    const { POST } = await import("@/app/api/notifications/push/route");
    const req = makeRequest(VALID_PAYLOAD, { "x-webhook-secret": "old-secret" });
    const res = await POST(req as Parameters<typeof POST>[0]);
    expect(res.status).not.toBe(401);
  });

  it("responde 401 si no coincide ni con current ni previous", async () => {
    vi.stubEnv("SUPABASE_WEBHOOK_SECRET", "new-secret");
    vi.stubEnv("SUPABASE_WEBHOOK_SECRET_PREVIOUS", "old-secret");
    const { POST } = await import("@/app/api/notifications/push/route");
    const req = makeRequest(VALID_PAYLOAD, { "x-webhook-secret": "unknown-secret" });
    const res = await POST(req as Parameters<typeof POST>[0]);
    expect(res.status).toBe(401);
  });
});
