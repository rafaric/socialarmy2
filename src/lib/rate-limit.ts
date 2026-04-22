// TODO: replace with @upstash/ratelimit for multi-instance support
const store = new Map<string, number[]>();

/**
 * Cleanup probabilístico: 1% de las llamadas eliminan entries vacías.
 * Evita memory leak si se generan muchas keys únicas.
 */
function maybeCleanup(): void {
  if (Math.random() > 0.01) return;
  for (const [key, timestamps] of store) {
    if (timestamps.length === 0) store.delete(key);
  }
}

/**
 * Sliding window rate limiter en memoria.
 *
 * @param key Identificador del bucket (ej. `packs/award:user:<id>`).
 * @param limit Cantidad máxima de requests permitidas dentro de la ventana.
 * @param windowMs Ancho de la ventana en milisegundos.
 * @returns true si la request está permitida, false si excede el límite.
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  // Bypass completo en entorno de test para evitar falsos positivos en CI.
  if (process.env.NODE_ENV === "test") return true;

  const now = Date.now();
  const cutoff = now - windowMs;

  const timestamps = store.get(key) ?? [];
  // Filtrar timestamps expirados (sliding window real, no fixed).
  const fresh = timestamps.filter((t) => t > cutoff);

  if (fresh.length >= limit) {
    store.set(key, fresh);
    maybeCleanup();
    return false;
  }

  fresh.push(now);
  store.set(key, fresh);
  maybeCleanup();
  return true;
}

/**
 * Construye la key de rate limit con fallback IP cuando no hay usuario autenticado.
 * Orden: userId → x-forwarded-for → "unknown"
 *
 * @param route Nombre de la ruta (ej. `packs/award`).
 * @param request Request de Next.js.
 * @param userId ID del usuario autenticado o null/undefined.
 */
export function buildKey(
  route: string,
  request: Request,
  userId?: string | null
): string {
  if (userId) return `${route}:user:${userId}`;
  const xff = request.headers.get("x-forwarded-for");
  const ip = xff ? xff.split(",")[0].trim() : "unknown";
  return `${route}:ip:${ip}`;
}
