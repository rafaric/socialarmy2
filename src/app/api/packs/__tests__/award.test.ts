import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Smoke test de integración para rate limiting.
 * Prueba directamente la función rateLimit con NODE_ENV=production
 * para verificar que el Map bloquea en la petición N+1.
 */
describe("rateLimit — smoke test de integración end-to-end", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("permite exactamente 5 requests y bloquea la 6ta (packs/award, 5 req/min)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { rateLimit, buildKey } = await import("@/lib/rate-limit");

    const req = new Request("http://localhost/api/packs/award", {
      headers: { "x-forwarded-for": "1.2.3.4" },
    });
    const key = buildKey("packs/award-smoke", req, "user-smoke-test");

    // 5 requests deben pasar
    for (let i = 0; i < 5; i++) {
      expect(rateLimit(key, 5, 60_000)).toBe(true);
    }

    // La 6ta debe ser bloqueada
    expect(rateLimit(key, 5, 60_000)).toBe(false);
  });

  it("la ventana deslizante libera slots cuando los timestamps expiran", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.useFakeTimers();
    const baseTime = Date.now();
    vi.setSystemTime(baseTime);

    const { rateLimit } = await import("@/lib/rate-limit");

    const key = "packs/award-window-smoke:user:window-test";

    // Llenar ventana de 1 seg con 5 requests
    for (let i = 0; i < 5; i++) {
      rateLimit(key, 5, 1_000);
    }
    expect(rateLimit(key, 5, 1_000)).toBe(false); // límite alcanzado

    // Avanzar tiempo para que todos los timestamps expiren
    vi.setSystemTime(baseTime + 1_001);

    // Ahora deben permitirse de nuevo
    expect(rateLimit(key, 5, 1_000)).toBe(true);

    vi.useRealTimers();
  });
});
