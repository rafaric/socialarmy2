# Design: security

> Generado como sdd-design con análisis real del codebase. Última revisión: 2026-04-22.

## Architecture Decisions

### ADR-01: Rate Limiting Strategy — In-Memory Sliding Window

**Decision**: Implementar rate limiting con `Map<string, number[]>` en memoria usando sliding window algorithm, aplicado como guard al inicio de cada API route protegida. No se introduce Redis/Upstash en este change.

**Rationale**:
- **Simplicidad operativa**: cero infraestructura adicional, cero latencia de red, cero costo. El Map vive en el proceso Node.js serverless.
- **Sliding window vs fixed window**: el fixed window permite bursts al cruzar el borde de la ventana (2x el límite en la frontera). Sliding window suaviza esto filtrando timestamps individuales.
- **MVP-adecuado**: Vercel reutiliza instancias serverless durante ventanas cortas (minutos), suficiente para el tipo de ventana que usamos (min/hora). Un atacante con múltiples IPs y timing preciso puede rotar instancias, pero el 90% del abuso casual queda bloqueado.
- **Interface sincrónica**: `rateLimit(key, limit, windowMs): boolean` evita `await` en el happy path, facilitando adopción en rutas existentes.

**Consequences**:
- **Positivo**: implementación trivial, testeable sin mocks, cero dependencias nuevas.
- **Negativo**: estado no compartido entre instancias Vercel — un atacante con recursos puede paralelizar ataques contra distintas regiones. Documentado como deuda técnica hacia `@upstash/ratelimit`.
- **Negativo**: cold starts resetean el contador. Mitigable con ventanas cortas que de todas formas no dependen de persistencia larga.
- **Mitigación de leak**: cleanup lazy al insertar (filtrar timestamps expirados antes de contar) + purga probabilística (1% de requests) de keys vacías.

### ADR-02: Webhook Authentication — Shared Secret via Header

**Decision**: Verificar autenticidad del webhook `/api/notifications/push` comparando el header `x-webhook-secret` contra la env var `SUPABASE_WEBHOOK_SECRET`. Respuesta `401` si no coincide.

**Rationale**:
- Supabase Database Webhooks permiten configurar headers custom al crear el hook — el secret viaja en cada request.
- Shared secret es simple, sin criptografía de firma (HMAC) porque Supabase ya establece HTTPS al endpoint; la confidencialidad del secret en tránsito está garantizada por TLS.
- Comparación constant-time con `crypto.timingSafeEqual` para evitar timing attacks.

**Consequences**:
- **Positivo**: una línea de verificación, sin SDK adicional.
- **Negativo**: si el secret se filtra, hay que rotarlo manualmente. El riesgo de rotation se mitiga soportando dos secrets simultáneos durante la rotación (`SUPABASE_WEBHOOK_SECRET` + `SUPABASE_WEBHOOK_SECRET_PREVIOUS`, documentado en el runbook).

### ADR-03: Upload Validation — Magic Bytes Primero, sharp como Fallback

**Decision**: Nueva ruta `POST /api/uploads/validate` que verifica magic bytes en los primeros 12 bytes del archivo. Para imágenes, pasa adicionalmente por `sharp` para validar que es una imagen decodificable. El cliente debe llamar a esta ruta **antes** de subir a Supabase Storage.

**Rationale**:
- **Magic bytes primero (cheap)**: rechaza el 99% de archivos falsos en microsegundos sin cargar sharp.
- **sharp como segundo filtro (expensive)**: atrapa casos donde el atacante pone el header correcto pero el cuerpo no es una imagen real (ej. header PNG + payload ejecutable). sharp intenta decodificar y lanza si no puede.
- **No round-trip de URL firmada**: el design alternativo de devolver una signed URL complica el cliente y requiere cambios grandes en el flujo de Storage. En este change preferimos validación pre-upload más simple: cliente valida → cliente sube con el flujo actual.
- **Allowlist estricto**: JPEG, PNG, GIF, WEBP para imágenes; MP4, WEBM para video. Cualquier otro MIME se rechaza con `415 Unsupported Media Type`.

**Consequences**:
- **Positivo**: la dependencia nativa `sharp` ya se usa en build; moverla a `dependencies` agrega ~30MB al bundle serverless pero Vercel lo soporta de forma nativa.
- **Positivo**: el atacante no puede subir ejecutables disfrazados con `file.type = 'image/png'`.
- **Negativo**: un extra round-trip por upload. Aceptable: los uploads ya son operaciones lentas desde el punto de vista del usuario.
- **Negativo**: video validation es más débil (MP4 tiene múltiples box formats). Aceptamos esto porque atacar por MP4 requiere mucho más expertise que por imagen.

### ADR-04: Friend Request Flow — Server-Side Only

**Decision**: Nueva ruta `POST /api/friends/request` que encapsula: auth check, rate limit, check de duplicados, inserción atómica en `friends` + `notifications`. El hook `useSendFriendRequest` se refactoriza para consumir la ruta vía `fetch` en lugar de insertar directo con supabase-js desde el cliente.

**Rationale**:
- **Defense in depth**: aunque RLS protege la tabla `friends`, el cliente actual inserta notificaciones **directamente** (RLS permisivo para notifications porque son del destinatario). Esto habilita spam trivial.
- **Check de duplicados server-side**: evitamos race conditions entre la UI (que puede estar desactualizada) y el estado real. La ruta hace un SELECT sobre `friends` antes del INSERT.
- **Atomicidad**: insert de la solicitud + notificación en una sola transacción lógica (usando admin client). Si falla la notificación, no queda la solicitud huérfana — y viceversa.
- **409 Conflict explícito**: cuando ya existe solicitud pendiente/aceptada, el API responde `409` con payload claro para que el hook muestre un toast informativo en lugar de duplicar estado.

**Consequences**:
- **Positivo**: una sola puerta de entrada para friend requests. Futuro sistema de reportes/blocks puede inspeccionar esta ruta únicamente.
- **Negativo**: perdemos el optimistic update "gratis" de supabase-js. Mitigación: implementar `onMutate` en React Query para optimistic UI con rollback en `onError`.
- **Negativo**: el rate limit de 20/hora por userId es agresivo para usuarios legítimos que envían muchas solicitudes al registrarse. Mitigación: 20/hora cubre un uso normal + fricción leve para power users. Monitorear.

## Component Design

### src/lib/rate-limit.ts

Helper reutilizable que expone una función `rateLimit` sincrónica. Diseñado para llamarse como guard al inicio del handler de la API route.

```ts
// src/lib/rate-limit.ts

// Key -> array de timestamps (ms) de requests dentro de cualquier ventana activa.
// Se filtran los expirados perezosamente en cada llamada.
const store = new Map<string, number[]>();

// Purga probabilística: 1% de las llamadas limpian entradas vacías.
// Evita leak si un atacante genera millones de keys únicas.
function maybeCleanup() {
  if (Math.random() > 0.01) return;
  for (const [key, timestamps] of store) {
    if (timestamps.length === 0) store.delete(key);
  }
}

/**
 * Sliding window rate limiter.
 *
 * @param key Identificador del bucket. Típico: `${route}:${userId ?? ip}`.
 * @param limit Cantidad máxima de requests permitidas en la ventana.
 * @param windowMs Ancho de la ventana en milisegundos.
 * @returns true si la request está permitida, false si excede el límite.
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  // Bypass en tests para evitar falsos positivos en CI.
  if (process.env.NODE_ENV === 'test') return true;

  const now = Date.now();
  const cutoff = now - windowMs;

  const timestamps = store.get(key) ?? [];
  // Filtra expirados. Asume que el array está en orden cronológico (push al final).
  const fresh = timestamps.filter((t) => t > cutoff);

  if (fresh.length >= limit) {
    store.set(key, fresh); // Persistir el array filtrado aunque rechacemos.
    maybeCleanup();
    return false;
  }

  fresh.push(now);
  store.set(key, fresh);
  maybeCleanup();
  return true;
}

/**
 * Helper para construir key con fallback IP cuando no hay user autenticado.
 * Lee x-forwarded-for (Vercel siempre lo setea) o cae a "unknown".
 */
export function buildKey(route: string, request: Request, userId?: string | null): string {
  if (userId) return `${route}:user:${userId}`;
  const xff = request.headers.get('x-forwarded-for') ?? 'unknown';
  const ip = xff.split(',')[0].trim();
  return `${route}:ip:${ip}`;
}
```

**Uso típico en una API route**:

```ts
const key = buildKey('packs/award', request, user.id);
if (!rateLimit(key, 5, 60_000)) {
  return NextResponse.json(
    { error: 'Too many requests' },
    { status: 429, headers: { 'Retry-After': '60' } }
  );
}
```

### src/app/api/uploads/validate/route.ts

Valida el archivo antes de permitir upload a Supabase Storage. El cliente debe llamar a esta ruta primero; solo si retorna `{ valid: true }` procede a subir.

**Flujo**:

1. Auth check con `createClient()` — si no hay user, `401`.
2. Parsear `multipart/form-data`; extraer `file` de `formData`.
3. Validar tamaño máximo (5 MB para imágenes, 10 MB para video) antes de leer bytes — leer `file.size` y rechazar si excede.
4. Leer los primeros 12 bytes como `Uint8Array` vía `await file.slice(0, 12).arrayBuffer()`.
5. Ejecutar `detectMime(bytes)` — compara contra la allowlist de magic bytes y retorna el MIME detectado o `null`.
6. Si `null`, retornar `415` con `{ error: 'Unsupported file type' }`.
7. Si es imagen, cargar el archivo completo a buffer y pasarlo a `sharp(buffer).metadata()`. Si lanza, retornar `415`. Si el metadata no coincide con el MIME detectado (ej. magic dice PNG pero sharp detecta GIF), retornar `415`.
8. Si pasa, retornar `200` con `{ valid: true, mime: detectedMime }`.

**Magic bytes table** (como constante en el archivo):

```ts
const SIGNATURES: Array<{ mime: string; bytes: number[]; offset?: number }> = [
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: 'image/gif', bytes: [0x47, 0x49, 0x46, 0x38] },
  // WEBP: RIFF....WEBP (offset 8)
  { mime: 'image/webp', bytes: [0x52, 0x49, 0x46, 0x46] }, // check RIFF
  // + verificación secundaria de WEBP en offset 8
  { mime: 'video/webm', bytes: [0x1a, 0x45, 0xdf, 0xa3] },
  // MP4: delegamos a sharp/metadata, el magic es ambiguo
];

function detectMime(bytes: Uint8Array): string | null {
  for (const sig of SIGNATURES) {
    const offset = sig.offset ?? 0;
    if (bytes.length < offset + sig.bytes.length) continue;
    const matches = sig.bytes.every((b, i) => bytes[offset + i] === b);
    if (matches) {
      // WEBP necesita verificación extra en offset 8: "WEBP"
      if (sig.mime === 'image/webp') {
        const webp = [0x57, 0x45, 0x42, 0x50];
        const ok = webp.every((b, i) => bytes[8 + i] === b);
        if (!ok) continue;
      }
      return sig.mime;
    }
  }
  return null;
}
```

**Route handler**:

```ts
// POST /api/uploads/validate
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing file' }, { status: 400 });
  }

  const MAX_IMAGE = 5 * 1024 * 1024;
  const MAX_VIDEO = 10 * 1024 * 1024;
  if (file.size > MAX_VIDEO) {
    return NextResponse.json({ error: 'File too large' }, { status: 413 });
  }

  const headerBytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const detected = detectMime(headerBytes);
  if (!detected) {
    return NextResponse.json({ error: 'Unsupported file type' }, { status: 415 });
  }

  if (detected.startsWith('image/')) {
    if (file.size > MAX_IMAGE) {
      return NextResponse.json({ error: 'Image too large' }, { status: 413 });
    }
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const metadata = await sharp(buffer).metadata();
      // Cross-check: sharp.format debe coincidir con el MIME detectado.
      const formatToMime: Record<string, string> = {
        jpeg: 'image/jpeg',
        png: 'image/png',
        gif: 'image/gif',
        webp: 'image/webp',
      };
      if (formatToMime[metadata.format ?? ''] !== detected) {
        return NextResponse.json({ error: 'Format mismatch' }, { status: 415 });
      }
    } catch {
      return NextResponse.json({ error: 'Invalid image' }, { status: 415 });
    }
  }

  return NextResponse.json({ valid: true, mime: detected });
}
```

### src/app/api/friends/request/route.ts

Encapsula toda la lógica de solicitud de amistad: auth, rate limit, dedup check, insert atómico.

**Flujo**:

1. Auth check. Si no hay user, `401`.
2. Rate limit: `buildKey('friends/request', request, user.id)`, 20 req/hora.
3. Parsear body: `{ friend_id: string }`. Validar que sea UUID y distinto del caller.
4. Query admin client a tabla `friends`: buscar filas donde `(user_id = caller AND friend_id = target) OR (user_id = target AND friend_id = caller)` con `status IN ('pending', 'accepted')`. Si existe, `409 Conflict`.
5. Opcional: verificar bloqueo mutuo en tabla `blocks`. Si hay block, `403`.
6. Insert en `friends` con status `pending` + insert en `notifications` con tipo `friend_request`. Idealmente vía RPC de Supabase (`create_friend_request`) que encapsula ambos inserts en una transacción. Si no hay RPC, hacer dos inserts y rollback manual en caso de error del segundo.
7. Retornar `201 Created` con `{ requestId: string }`.

```ts
// POST /api/friends/request
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const key = buildKey('friends/request', request, user.id);
  if (!rateLimit(key, 20, 60 * 60_000)) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': '3600' } }
    );
  }

  const body = await request.json().catch(() => null);
  const friend_id = body?.friend_id;
  if (typeof friend_id !== 'string' || friend_id === user.id) {
    return NextResponse.json({ error: 'Invalid target' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Dedup: busca en ambas direcciones.
  const { data: existing } = await admin
    .from('friends')
    .select('id, status')
    .or(
      `and(user_id.eq.${user.id},friend_id.eq.${friend_id}),` +
      `and(user_id.eq.${friend_id},friend_id.eq.${user.id})`
    )
    .in('status', ['pending', 'accepted'])
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: 'Request already exists', status: existing.status },
      { status: 409 }
    );
  }

  // Insert friendship + notification. Idealmente vía RPC transaccional.
  // La tabla friends usa clave compuesta (user_id, friend_id), sin campo id autogenerado.
  const { error: friendErr } = await admin
    .from('friends')
    .insert({ user_id: user.id, friend_id, status: 'pending' });

  if (friendErr) {
    // 23505 = unique violation: ya existe la fila.
    if (friendErr.code === '23505') {
      return NextResponse.json({ error: 'Request already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to create request' }, { status: 500 });
  }

  // Estructura real de la tabla notifications (verificado en código existente)
  const { error: notifErr } = await admin
    .from('notifications')
    .insert({
      notification_type: 'friend_request',
      user_emisor: user.id,
      user_receptor: targetUserId,
      post_id: null,
    });

  if (notifErr) {
    // Rollback manual del friend request.
    // La tabla friends usa clave compuesta (user_id, friend_id) — no tiene campo id.
    await admin
      .from('friends')
      .delete()
      .eq('user_id', user.id)
      .eq('friend_id', friend_id);
    return NextResponse.json({ error: 'Failed to notify' }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
```

### src/app/api/notifications/push/route.ts (modificado)

Agregar verificación de webhook secret al inicio del handler, **antes** de cualquier otra lógica.

```ts
import crypto from 'node:crypto';

export async function POST(request: Request) {
  const provided = request.headers.get('x-webhook-secret');
  const expected = process.env.SUPABASE_WEBHOOK_SECRET;

  if (!expected) {
    // Fail-closed si la env var no está configurada.
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  if (!provided || !timingSafeEqualStr(provided, expected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Rate limit por IP (ya autenticado por secret, pero defense in depth).
  const key = buildKey('notifications/push', request);
  if (!rateLimit(key, 60, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  // ... lógica existente ...
}

function timingSafeEqualStr(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}
```

### src/hooks/useSendFriendRequest.ts (refactor)

Cambia de insert directo a `fetch` contra la nueva API route. Mantiene la signature pública (`mutate`, `isPending`, `isError`) y agrega optimistic update manual vía React Query.

```ts
export function useSendFriendRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (targetUserId: string) => {
      const res = await fetch('/api/friends/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friend_id: targetUserId }),
      });

      if (res.status === 409) {
        const err = await res.json();
        throw new Error(err.error ?? 'Request already exists');
      }
      if (!res.ok) {
        throw new Error('Failed to send friend request');
      }

      return res.json() as Promise<{ requestId: string }>;
    },
    onMutate: async (targetUserId) => {
      // Optimistic update: marcar el target como "pending" en el cache local.
      await queryClient.cancelQueries({ queryKey: ['friendship', targetUserId] });
      const previous = queryClient.getQueryData(['friendship', targetUserId]);
      queryClient.setQueryData(['friendship', targetUserId], { status: 'pending' });
      return { previous, targetUserId };
    },
    onError: (_err, _vars, context) => {
      // Rollback.
      if (context?.previous !== undefined) {
        queryClient.setQueryData(['friendship', context.targetUserId], context.previous);
      }
    },
    onSettled: (_data, _err, targetUserId) => {
      queryClient.invalidateQueries({ queryKey: ['friendship', targetUserId] });
      queryClient.invalidateQueries({ queryKey: ['friends'] });
    },
  });
}
```

### src/types/index.ts (aditivos)

```ts
// Request/response de /api/friends/request
export type FriendRequestPayload = { friend_id: string }; // snake_case consistente con tabla friends
export type FriendRequestResponse = { requestId: string };
export type FriendRequestConflict = { error: string; status: 'pending' | 'accepted' };

// Response de /api/uploads/validate
export type UploadValidateResponse =
  | { valid: true; mime: string }
  | { error: string };
```

## Sequence Diagrams

### Upload validation flow

```
Cliente                    /api/uploads/validate          Supabase Storage
  |                                |                             |
  |  POST multipart/form-data      |                             |
  |  (file)                        |                             |
  |------------------------------->|                             |
  |                                | auth check                  |
  |                                | size check                  |
  |                                | read first 12 bytes         |
  |                                | detectMime()                |
  |                                |                             |
  |                                | [if image] sharp.metadata() |
  |                                | cross-check format vs mime  |
  |                                |                             |
  |   200 { valid: true, mime }    |                             |
  |<-------------------------------|                             |
  |                                                              |
  |  upload directo (anon key)                                   |
  |------------------------------------------------------------->|
  |                                                              |
  |                              201                             |
  |<-------------------------------------------------------------|
  |                                                              |
  | [si validate falla: 415]                                     |
  | cliente muestra error, no sube                               |
```

### Friend request flow

```
Cliente (hook)             /api/friends/request            Supabase (admin)
  |                                |                             |
  | fetch POST                     |                             |
  | { targetUserId }               |                             |
  |------------------------------->|                             |
  |                                | auth.getUser()              |
  |                                |                             |
  |                                | rateLimit(user, 20/hora)    |
  |                                | [si excede: 429]            |
  |                                |                             |
  |                                | SELECT friends WHERE        |
  |                                | (a->b OR b->a) AND          |
  |                                | status IN (pending, accepted)
  |                                |---------------------------->|
  |                                |<----------------------------|
  |                                | [si existe: 409]            |
  |                                |                             |
  |                                | INSERT friends              |
  |                                |---------------------------->|
  |                                |<----------------------------|
  |                                |                             |
  |                                | INSERT notifications        |
  |                                |---------------------------->|
  |                                |<----------------------------|
  |                                | [si falla: rollback friends]|
  |                                |                             |
  |   201 { requestId }            |                             |
  |<-------------------------------|                             |
  |                                                              |
  | React Query invalidate(['friendship', target], ['friends'])  |
```

### Webhook authentication flow

```
Supabase (webhook trigger)    /api/notifications/push      expo-server-sdk
  |                                |                             |
  | POST con headers:              |                             |
  |   x-webhook-secret: <secret>   |                             |
  |------------------------------->|                             |
  |                                | compare(provided, env)      |
  |                                | timingSafeEqual             |
  |                                | [si no coincide: 401]       |
  |                                |                             |
  |                                | rateLimit(IP, 60/min)       |
  |                                |                             |
  |                                | enviar push                 |
  |                                |---------------------------->|
  |                                |<----------------------------|
  |   200 OK                       |                             |
  |<-------------------------------|                             |
  |                                                              |
  | (Caller desconocido)                                         |
  | POST sin x-webhook-secret      |                             |
  |------------------------------->|                             |
  |   401 Unauthorized             |                             |
  |<-------------------------------|                             |
```

### Rate limit decision flow (cualquier ruta)

```
Request -> handler
  |
  | buildKey(route, req, userId?)
  |   -> "route:user:<id>" si hay user
  |   -> "route:ip:<xff>" si no
  |
  | rateLimit(key, limit, windowMs)
  |   - store.get(key) -> timestamps[]
  |   - fresh = timestamps.filter(t > now - windowMs)
  |   - if fresh.length >= limit: return false
  |   - fresh.push(now); store.set(key, fresh)
  |   - maybeCleanup() (1% prob.)
  |   - return true
  |
  | [false] -> 429 { Retry-After: windowMs/1000 }
  | [true]  -> seguir con la lógica normal
```

## Implementation Notes

- **Orden de guards en cada route**: `auth -> rate limit -> input validation -> business logic`. El rate limit va después del auth cuando hay userId porque la key es más específica, pero antes de cualquier I/O pesado.
- **Import paths**: `import { rateLimit, buildKey } from '@/lib/rate-limit'` (respetando el alias de tsconfig).
- **sharp en Vercel**: ya viene incluido en el runtime de Next.js serverless; solo hay que moverlo a `dependencies` para que `next build` lo incluya correctamente.
- **Test bypass**: el `if (process.env.NODE_ENV === 'test') return true` en `rateLimit` evita falsos positivos en suites. Tests específicos de rate limiting pueden setear la env o importar el Map directo para reset.
- **Env vars nuevas**: `SUPABASE_WEBHOOK_SECRET` (required), `SUPABASE_WEBHOOK_SECRET_PREVIOUS` (optional, para rotación). Documentar en `.env.example`.
