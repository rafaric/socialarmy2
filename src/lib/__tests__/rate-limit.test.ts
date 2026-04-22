import { describe, it, expect, beforeEach, vi } from "vitest";

// Importamos el módulo limpio en cada test con resetModules
// para evitar contaminación del Map entre tests.
describe("rateLimit — sliding window", () => {
  beforeEach(() => {
    vi.resetModules();
    // Restaurar NODE_ENV al valor original si fue modificado
    vi.unstubAllEnvs();
  });

  it("retorna true en NODE_ENV=test siempre (bypass)", async () => {
    vi.stubEnv("NODE_ENV", "test");
    const { rateLimit } = await import("@/lib/rate-limit");
    expect(rateLimit("key", 1, 60_000)).toBe(true);
    expect(rateLimit("key", 1, 60_000)).toBe(true);
    expect(rateLimit("key", 1, 60_000)).toBe(true);
  });

  it("permite requests hasta el límite en NODE_ENV=production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { rateLimit } = await import("@/lib/rate-limit");
    expect(rateLimit("prod-key", 3, 60_000)).toBe(true);
    expect(rateLimit("prod-key", 3, 60_000)).toBe(true);
    expect(rateLimit("prod-key", 3, 60_000)).toBe(true);
  });

  it("bloquea al exceder el límite en NODE_ENV=production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { rateLimit } = await import("@/lib/rate-limit");
    rateLimit("limit-key", 2, 60_000);
    rateLimit("limit-key", 2, 60_000);
    expect(rateLimit("limit-key", 2, 60_000)).toBe(false);
  });

  it("timestamps expirados no se cuentan (sliding window real)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { rateLimit } = await import("@/lib/rate-limit");

    // Usar Date.now real pero simular tiempo con vi.setSystemTime
    const baseTime = 1_000_000;
    vi.setSystemTime(baseTime);

    rateLimit("sliding-key", 2, 1_000); // +1 dentro de ventana
    rateLimit("sliding-key", 2, 1_000); // +1 dentro de ventana (límite alcanzado)

    // Avanzar el tiempo más allá de la ventana (1001ms)
    vi.setSystemTime(baseTime + 1_001);

    // Debe permitir porque los timestamps anteriores están fuera de ventana
    expect(rateLimit("sliding-key", 2, 1_000)).toBe(true);

    vi.useRealTimers();
  });
});

describe("buildKey — construcción de clave", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("retorna {route}:user:{userId} cuando hay userId", async () => {
    const { buildKey } = await import("@/lib/rate-limit");
    const req = new Request("https://example.com", {
      headers: { "x-forwarded-for": "1.2.3.4" },
    });
    expect(buildKey("packs/award", req, "user-abc")).toBe("packs/award:user:user-abc");
  });

  it("retorna {route}:ip:{ip} cuando hay x-forwarded-for y no userId", async () => {
    const { buildKey } = await import("@/lib/rate-limit");
    const req = new Request("https://example.com", {
      headers: { "x-forwarded-for": "10.0.0.1, 10.0.0.2" },
    });
    expect(buildKey("unfurl", req, null)).toBe("unfurl:ip:10.0.0.1");
  });

  it("retorna {route}:ip:unknown cuando no hay userId ni header", async () => {
    const { buildKey } = await import("@/lib/rate-limit");
    const req = new Request("https://example.com");
    expect(buildKey("blocks", req, null)).toBe("blocks:ip:unknown");
  });

  it("retorna {route}:ip:unknown cuando userId es undefined", async () => {
    const { buildKey } = await import("@/lib/rate-limit");
    const req = new Request("https://example.com");
    expect(buildKey("friends/request", req, undefined)).toBe("friends/request:ip:unknown");
  });
});
