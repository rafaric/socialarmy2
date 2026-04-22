# Tasks: security

> Change: security
> Status: draft
> Date: 2026-04-22
> Test runner: `bun run test` (vitest + jsdom, archivos en `src/**/*.{test,spec}.{ts,tsx}`)

---

## Phase 1: Infrastructure

### 1.0 Mover `sharp` de `devDependencies` a `dependencies` en `package.json`

**Descripcion**: `sharp` se usa en runtime serverless para validar imágenes. En `devDependencies` no se incluye en el bundle de producción de Vercel.

**Archivos afectados**:
- `package.json`

**Criterio de done**:
- `sharp` aparece bajo `dependencies` con la misma versión que tenía en `devDependencies` (sin downgrade)
- `sharp` ya NO aparece en `devDependencies`

**Dependencias**: ninguna

---

### 1.1 Crear `src/lib/rate-limit.ts` — helper sliding window

**Descripcion**: Helper reutilizable con `rateLimit(key, limit, windowMs)` y `buildKey(route, request, userId?)`. Implementar sliding window con Map en memoria, cleanup probabilístico 1%, y bypass para `NODE_ENV === 'test'`.

**Archivos afectados**:
- `src/lib/rate-limit.ts` (nuevo)

**Criterio de done**:
- Exporta `rateLimit(key: string, limit: number, windowMs: number): boolean`
- Exporta `buildKey(route: string, request: Request, userId?: string | null): string`
- El Map incluye el comentario `// TODO: replace with @upstash/ratelimit for multi-instance support`
- Con `NODE_ENV === 'test'` siempre retorna `true` sin modificar el Map
- `buildKey` lee `x-forwarded-for`, luego `request.ip`, luego `"unknown"` como fallback
- Key format para user: `{route}:user:{userId}` — para IP: `{route}:ip:{ip}`

**Dependencias**: ninguna

---

### 1.2 Documentar variables de entorno en `.env.example`

**Descripcion**: Agregar `SUPABASE_WEBHOOK_SECRET` y `SUPABASE_WEBHOOK_SECRET_PREVIOUS` con valores placeholder y comentarios explicativos.

**Archivos afectados**:
- `.env.example`

**Criterio de done**:
- `.env.example` contiene `SUPABASE_WEBHOOK_SECRET=your-secret-here` con comentario
- `.env.example` contiene `SUPABASE_WEBHOOK_SECRET_PREVIOUS=` (vacío, opcional) con comentario de rotación
- Los comentarios explican el propósito (webhook auth) y que la ausencia no rompe dev

**Dependencias**: ninguna

---

### 1.3 Agregar tipos nuevos en `src/types/index.ts`

**Descripcion**: Agregar los tipos de payload/response para `friends/request` y `uploads/validate` que serán usados por la API route y el hook.

**Archivos afectados**:
- `src/types/index.ts`

**Criterio de done**:
- Exporta `FriendRequestPayload = { friend_id: string }`
- Exporta `FriendRequestResponse = { requestId: string }`
- Exporta `FriendRequestConflict = { error: string; status: 'pending' | 'accepted' }`
- Exporta `UploadValidateResponse = { valid: true; mime: string } | { error: string }`
- Sin `any` implícitos ni casts sin justificación

**Dependencias**: ninguna

---

## Phase 2: Implementation

### 2.0 Feature 1: Rate Limiting en rutas existentes

#### 2.1 [test] Tests para `src/lib/rate-limit.ts`

**Descripcion**: Cubrir los comportamientos clave del helper: sliding window, cleanup, bypass en test, y construcción de key.

**Archivos afectados**:
- `src/lib/__tests__/rate-limit.test.ts` (nuevo)

**Criterio de done**:
- Test: con `NODE_ENV === 'test'` siempre retorna `true`
- Test: bajo el límite retorna `true` y el conteo crece
- Test: al alcanzar `limit` retorna `false`
- Test: timestamps expirados (fuera de `windowMs`) no se cuentan
- Test: `buildKey` con userId retorna `{route}:user:{userId}`
- Test: `buildKey` sin userId lee `x-forwarded-for` y retorna `{route}:ip:{ip}`
- Test: `buildKey` sin usuario ni header retorna `{route}:ip:unknown`
- Todos los tests pasan con `bun run test`

**Dependencias**: 1.1

---

#### 2.2 [impl] Aplicar `rateLimit` en `POST /api/packs/award`

**Descripcion**: Agregar guard de rate limit al inicio del handler. Límite: 5 req/min por userId.

**Archivos afectados**:
- `src/app/api/packs/award/route.ts`

**Criterio de done**:
- Importa `{ rateLimit, buildKey }` desde `@/lib/rate-limit`
- Guard ejecutado ANTES de cualquier business logic: `buildKey('packs/award', request, user.id)`, `rateLimit(key, 5, 60_000)`
- Si `rateLimit` retorna `false`: responde HTTP 429 con `{ error: 'Too many requests', retryAfter: 60 }` y header `Retry-After: 60`
- Loga el rechazo con route, userId y motivo (sin datos sensibles)
- El guard va DESPUÉS del auth check (key usa userId), ANTES de cualquier I/O adicional

**Dependencias**: 1.1, 2.1

---

#### 2.3 [impl] Aplicar `rateLimit` en `/api/unfurl`

**Descripcion**: Agregar guard de rate limit. Límite: 10 req/min, usar userId si disponible o IP como fallback.

**Archivos afectados**:
- `src/app/api/unfurl/route.ts`

**Criterio de done**:
- Importa `{ rateLimit, buildKey }` desde `@/lib/rate-limit`
- Usa `buildKey('unfurl', request, user?.id ?? null)` — soporta unauthenticated
- Límite: `rateLimit(key, 10, 60_000)`
- Si excede: HTTP 429 con `{ error: 'Too many requests', retryAfter: 60 }` + header `Retry-After: 60`
- Guard ocurre antes de cualquier fetch externo de unfurl

**Dependencias**: 1.1, 2.1

---

#### 2.4 [impl] Aplicar `rateLimit` en `/api/blocks`

**Descripcion**: Agregar guard de rate limit. Límite: 10 req/min por userId (ruta autenticada).

**Archivos afectados**:
- `src/app/api/blocks/route.ts`

**Criterio de done**:
- Importa `{ rateLimit, buildKey }` desde `@/lib/rate-limit`
- Usa `buildKey('blocks', request, user.id)`
- Límite: `rateLimit(key, 10, 60_000)`
- Si excede: HTTP 429 con `{ error: 'Too many requests', retryAfter: 60 }` + header `Retry-After: 60`
- Guard ocurre antes del business logic, después del auth check

**Dependencias**: 1.1, 2.1

---

### 2.5 Feature 2: Webhook Secret Authentication

#### 2.6 [test] Tests para verificación de webhook secret en `/api/notifications/push`

**Descripcion**: Cubrir los escenarios de autenticación del webhook: secret correcto, incorrecto, ausente, sin env var, y rotación con secret anterior.

**Archivos afectados**:
- `src/app/api/notifications/__tests__/push.test.ts` (nuevo)

**Criterio de done**:
- Test: header `x-webhook-secret` coincide con env → pasa la verificación (no retorna 401)
- Test: header ausente → responde 401 `{ error: 'Unauthorized' }`
- Test: header con valor incorrecto → responde 401 `{ error: 'Unauthorized' }`
- Test: `SUPABASE_WEBHOOK_SECRET` no definida → `console.warn` emitido, request continúa
- Test: header coincide con `SUPABASE_WEBHOOK_SECRET_PREVIOUS` → pasa la verificación
- Test: ninguno de los dos secrets coincide → 401
- Todos los tests pasan con `bun run test`

**Dependencias**: 1.1

---

#### 2.7 [impl] Agregar webhook secret check en `POST /api/notifications/push`

**Descripcion**: Verificar `x-webhook-secret` con `crypto.timingSafeEqual` al inicio del handler. Soportar rotación con secret anterior. Si la env var no está definida, emitir warning y continuar (dev permisivo).

**Archivos afectados**:
- `src/app/api/notifications/push/route.ts`

**Criterio de done**:
- Importa `crypto` desde `node:crypto`
- Importa `{ rateLimit, buildKey }` desde `@/lib/rate-limit`
- Verificación es el PRIMER paso del handler (antes de leer body)
- Usa `crypto.timingSafeEqual` para comparación de tiempo constante; si los buffers tienen distinto tamaño, retorna `false` directamente
- Si `SUPABASE_WEBHOOK_SECRET` no está definida: `console.warn('SUPABASE_WEBHOOK_SECRET not set...')` y continúa
- Si está definida pero no coincide (ni con current ni con previous): HTTP 401 `{ error: 'Unauthorized' }`
- Acepta requests donde el header coincide con `SUPABASE_WEBHOOK_SECRET_PREVIOUS` (rotación sin downtime)
- Agrega rate limit por IP después del auth check: `buildKey('notifications/push', request)`, 60 req/min

**Dependencias**: 1.1, 2.6

---

### 2.8 Feature 3: Upload Validation

#### 2.9 [test] Tests para `POST /api/uploads/validate`

**Descripcion**: Cubrir los flujos de validación: auth, tamaño, magic bytes, validación con sharp para imágenes, y respuestas exitosas.

**Archivos afectados**:
- `src/app/api/uploads/__tests__/validate.test.ts` (nuevo)

**Criterio de done**:
- Test: request sin autenticación → 401
- Test: archivo supera 50 MB (video) → 413 `{ error: 'File too large', maxBytes: 52428800 }`
- Test: archivo supera 5 MB siendo imagen → 413
- Test: bytes no reconocidos → 415 `{ error: 'Unsupported file type', detectedMime: null }`
- Test: magic bytes de JPEG válidos → `detectMime` retorna `'image/jpeg'`
- Test: magic bytes de PNG válidos → `'image/png'`
- Test: magic bytes de GIF válidos → `'image/gif'`
- Test: magic bytes de WEBP (RIFF+WEBP) → `'image/webp'`
- Test: magic bytes de WebM → `'video/webm'`
- Test: imagen con sharp que lanza → 415 `{ error: 'Invalid image' }`
- Test: imagen válida que pasa sharp → 200 `{ valid: true, mime: 'image/jpeg' }`
- Todos los tests pasan con `bun run test`

**Dependencias**: 1.0, 1.1

---

#### 2.10 [impl] Crear `POST /api/uploads/validate` route

**Descripcion**: Nuevo endpoint que valida un archivo multipart antes del upload: auth check, size limit, magic bytes detection, sharp validation para imágenes.

**Archivos afectados**:
- `src/app/api/uploads/validate/route.ts` (nuevo)

**Criterio de done**:
- Flujo en orden estricto: 1) auth → 2) parse formData → 3) size check → 4) magic bytes → 5) sharp (si imagen) → 6) response
- Auth: usa `createClient()` de `@/lib/supabase/server`; si no hay user → 401
- Size: imagen > 5 MB → 413 `{ error: 'File too large', maxBytes: 5242880 }`; video > 50 MB → 413 `{ error: 'File too large', maxBytes: 52428800 }`; check de video primero (límite mayor), luego imagen
- Magic bytes: lee primeros 12 bytes con `file.slice(0, 12).arrayBuffer()`
- Función `detectMime(bytes: Uint8Array): string | null` implementa la tabla de la spec: JPEG (`FF D8 FF`), PNG (`89 50 4E 47`), GIF (`47 49 46 38`), WEBP (RIFF en 0 + WEBP en offset 8), WebM (`1A 45 DF A3`), MP4 (bytes 4-7 = `66 74 79 70`)
- Si `detectMime` retorna `null` → 415 `{ error: 'Unsupported media type', detectedMime: null }`
- Para imágenes: carga buffer completo, llama `sharp(buffer).metadata()`, cross-check `metadata.format` vs MIME detectado. Si no coinciden o sharp lanza → 415
- Para videos: NO llama sharp, solo magic bytes
- Éxito: 200 `{ valid: true, mime: detectedMime }`
- `Content-Type` declarado por el cliente es ignorado; el MIME detectado manda

**Dependencias**: 1.0, 1.3, 2.9

---

### 2.11 Feature 4: Friend Request Anti-Spam

#### 2.12 [test] Tests para `POST /api/friends/request`

**Descripcion**: Cubrir auth, rate limit, validación de UUID, self-request, dedup, bloqueo mutuo, inserción atómica y race condition con unique constraint.

**Archivos afectados**:
- `src/app/api/friends/__tests__/request.test.ts` (nuevo)

**Criterio de done**:
- Test: sin autenticación → 401
- Test: body con `friend_id` inválido (no UUID) → 400
- Test: `friend_id` igual al caller → 400 `{ error: 'Cannot send friend request to yourself' }`
- Test: ya existe solicitud pending en dirección A→B → 409 `{ error: 'Friend request already pending' }`
- Test: ya existe solicitud pending en dirección B→A → 409 `{ error: 'Friend request already pending' }`
- Test: ya son amigos (status accepted) → 409 `{ error: 'Already friends' }`
- Test: existe bloqueo en cualquier dirección → 403 `{ error: 'Cannot send friend request' }`
- Test: todo OK, insert exitoso → 201 `{ requestId: string }`
- Test: insert falla con código 23505 (unique violation / race condition) → 409
- Todos los tests pasan con `bun run test`

**Dependencias**: 1.1, 1.3

---

#### 2.13 [impl] Crear `POST /api/friends/request` route

**Descripcion**: Nueva ruta que encapsula auth, rate limit, dedup check bidireccional, block check, e inserción atómica de solicitud + notificación con rollback manual.

**Archivos afectados**:
- `src/app/api/friends/request/route.ts` (nuevo)

**Criterio de done**:
- Flujo en orden: 1) auth → 2) rate limit → 3) validar body → 4) dedup check → 5) block check → 6) insert atómico → 7) response
- Auth: usa `createClient()`; si no hay user → 401
- Rate limit: `buildKey('friends/request', request, user.id)`, 20 req por 3600_000 ms; si excede → 429 con header `Retry-After: 3600`
- Validación: `friend_id` debe ser string UUID y distinto de `user.id`; si falla → 400 con mensaje específico
- Dedup: query con admin client a `friends` buscando en ambas direcciones con `status IN ('pending', 'accepted')`. Si pending → 409 `{ error: 'Friend request already pending' }`. Si accepted → 409 `{ error: 'Already friends' }`
- Block check: query a `blocks` buscando en ambas direcciones. Si existe → 403 `{ error: 'Cannot send friend request' }` (no revelar dirección del bloqueo)
- Insert: primero en `friends` (user_id, friend_id, status='pending'), luego en `notifications` (notification_type='friend_request', user_emisor, user_receptor, post_id=null). Si el insert de notifications falla → rollback del insert en friends (delete por user_id + friend_id). Si insert de friends falla con código 23505 → 409
- Éxito: 201 `{ requestId: string }` (id de la fila en friends si la tabla lo tiene, o `{ ok: true }` si usa clave compuesta sin id)
- Importa tipos desde `@/types`

**Dependencias**: 1.1, 1.3, 2.12

---

#### 2.14 [test] Tests para `useSendFriendRequest` refactorizado

**Descripcion**: Verificar que el hook llama a `fetch('/api/friends/request')` en lugar de supabase directo, mantiene la signature pública, hace optimistic update y rollback correcto.

**Archivos afectados**:
- `src/hooks/__tests__/useSendFriendRequest.test.ts` (nuevo)

**Criterio de done**:
- Test: `mutationFn` realiza `fetch` a `/api/friends/request` con `method: 'POST'` y `{ friend_id: targetUserId }` en body
- Test: NO hay ninguna llamada a `supabase.from('friends').insert` ni `supabase.from('notifications').insert`
- Test: 409 del API → el hook lanza error con el mensaje del body
- Test: `onMutate` setea `['friendship', targetUserId]` a `{ status: 'pending' }` en el cache de React Query
- Test: `onError` restaura el valor previo en `['friendship', targetUserId]`
- Test: `onSettled` invalida queries `['friendship', targetUserId]` y `['friends']`
- Signature pública: `{ mutate, isPending, isError, isSuccess }` no cambia
- Todos los tests pasan con `bun run test`

**Dependencias**: 2.13

---

#### 2.15 [impl] Refactorizar `useSendFriendRequest` para consumir la API route

**Descripcion**: Cambiar la implementación interna del hook para usar `fetch('/api/friends/request')`. Agregar optimistic update con rollback. Mantener signature pública intacta.

**Archivos afectados**:
- `src/hooks/useSendFriendRequest.ts` (nota: puede estar en `useFriends.ts` — verificar antes de editar)

**Criterio de done**:
- `mutationFn` usa `fetch('/api/friends/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ friend_id: targetUserId }) })`
- Elimina cualquier `supabase.from('friends').insert(...)` y `supabase.from('notifications').insert(...)` del cliente
- `onMutate`: cancela queries `['friendship', targetUserId]`, guarda snapshot previo, setea optimistic state `{ status: 'pending' }`
- `onError`: restaura el snapshot previo vía `queryClient.setQueryData`
- `onSettled`: invalida `['friendship', targetUserId]` y `['friends']`
- Maneja errores 409, 429, 403 con mensajes claros (para toast en UI)
- Firma pública `{ mutate, isPending, isError, isSuccess }` no cambia

**Dependencias**: 2.14

---

## Phase 3: Testing & Verification

### 3.0 Verificar que no quedan inserciones directas desde cliente para friend requests

**Descripcion**: Buscar en todo el codebase llamadas a `supabase.from('notifications').insert` o `supabase.from('friends').insert` que pertenezcan a flujos de friend requests y eliminarlas.

**Archivos afectados**:
- Cualquier archivo bajo `src/` que contenga dichas llamadas relacionadas con friend requests

**Criterio de done**:
- `rg "supabase.from\('friends'\).insert" src/` no arroja resultados en código cliente (hooks, componentes)
- `rg "supabase.from\('notifications'\).insert" src/` no arroja resultados relacionados con friend_request en código cliente
- Si se encuentran, se eliminan y la lógica fluye únicamente por `/api/friends/request`

**Dependencias**: 2.15

---

### 3.1 Smoke test de integración — rate limiting end-to-end

**Descripcion**: Test de integración que verifica el comportamiento de rate limiting en un handler real mockeado, asegurando que el guard rechaza correctamente en la petición N+1.

**Archivos afectados**:
- `src/app/api/packs/__tests__/award.test.ts` (nuevo o existente)

**Criterio de done**:
- Test: 5 peticiones consecutivas a `/api/packs/award` con el mismo userId pasan (mock del handler con `rateLimit` real, `NODE_ENV` diferente de 'test' para el scope del test)
- Test: la 6ta petición retorna 429 con header `Retry-After: 60`
- El Map del módulo es reseteado entre tests via `vi.resetModules()` o importando el Map directamente para limpieza

**Dependencias**: 2.2

---

### 3.2 TypeScript check — sin errores en archivos nuevos

**Descripcion**: Verificar que todos los archivos nuevos y modificados compilan sin errores de TypeScript en modo strict.

**Archivos afectados**:
- `src/lib/rate-limit.ts`
- `src/app/api/uploads/validate/route.ts`
- `src/app/api/friends/request/route.ts`
- `src/app/api/notifications/push/route.ts`
- `src/hooks/useSendFriendRequest.ts` (o `useFriends.ts`)
- `src/types/index.ts`

**Criterio de done**:
- `bun run tsc --noEmit` no reporta errores en ninguno de los archivos listados
- Sin `any` implícitos, sin casts sin justificación
- Todos los tipos nuevos están en `src/types/index.ts` o en los archivos de route correspondientes

**Dependencias**: 2.2, 2.4, 2.7, 2.10, 2.13, 2.15

---

### 3.3 Revisión final de logging de seguridad

**Descripcion**: Verificar que todos los rechazos por rate limit, webhook secret inválido, y validación de upload loguean el evento con contexto suficiente para auditoría.

**Archivos afectados**:
- `src/app/api/packs/award/route.ts`
- `src/app/api/unfurl/route.ts`
- `src/app/api/blocks/route.ts`
- `src/app/api/notifications/push/route.ts`
- `src/app/api/uploads/validate/route.ts`
- `src/app/api/friends/request/route.ts`

**Criterio de done**:
- Cada rechazo por rate limit tiene un `console.warn` o logger con: ruta, userId o IP (enmascarada si aplica), motivo (`rate_limit_exceeded`)
- Rechazo por webhook secret tiene: ruta, IP, motivo (`invalid_webhook_secret`)
- Rechazo por upload inválido tiene: ruta, userId, motivo (`invalid_mime` o `file_too_large`), tipo detectado
- Ningún log incluye el body completo de la request ni datos sensibles (tokens, secrets, PII completa)

**Dependencias**: 2.2, 2.4, 2.7, 2.10, 2.13

---

## Resumen de dependencias

```
1.0 ──────────────────────────────────────> 2.9 -> 2.10
1.1 -> 2.1 -> 2.2 -> 3.1
            -> 2.3
            -> 2.4
       2.6 -> 2.7
       2.9 -> 2.10 (también depende de 1.0)
       2.12 -> 2.13 -> 2.14 -> 2.15 -> 3.0
1.3 ──> 2.10
     -> 2.12 -> 2.13
```

| Task | Descripcion breve | Fase | Depende de |
|------|-------------------|------|------------|
| 1.0  | `sharp` a `dependencies` | Infra | — |
| 1.1  | `rate-limit.ts` helper | Infra | — |
| 1.2  | `.env.example` webhook vars | Infra | — |
| 1.3  | Tipos en `src/types/index.ts` | Infra | — |
| 2.1  | [test] `rate-limit.ts` | Impl | 1.1 |
| 2.2  | [impl] rate limit en `/api/packs/award` | Impl | 1.1, 2.1 |
| 2.3  | [impl] rate limit en `/api/unfurl` | Impl | 1.1, 2.1 |
| 2.4  | [impl] rate limit en `/api/blocks` | Impl | 1.1, 2.1 |
| 2.6  | [test] webhook secret check | Impl | 1.1 |
| 2.7  | [impl] webhook secret en `push` route | Impl | 1.1, 2.6 |
| 2.9  | [test] `uploads/validate` | Impl | 1.0, 1.1 |
| 2.10 | [impl] `POST /api/uploads/validate` | Impl | 1.0, 1.3, 2.9 |
| 2.12 | [test] `friends/request` route | Impl | 1.1, 1.3 |
| 2.13 | [impl] `POST /api/friends/request` | Impl | 1.1, 1.3, 2.12 |
| 2.14 | [test] `useSendFriendRequest` refactor | Impl | 2.13 |
| 2.15 | [impl] refactor `useSendFriendRequest` | Impl | 2.14 |
| 3.0  | Verificar 0 inserciones directas cliente | Verify | 2.15 |
| 3.1  | Smoke test rate limit end-to-end | Verify | 2.2 |
| 3.2  | TypeScript check sin errores | Verify | 2.2–2.15 |
| 3.3  | Revisión logging de seguridad | Verify | 2.2–2.13 |
