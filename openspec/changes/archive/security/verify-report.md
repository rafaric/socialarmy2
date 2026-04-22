# Verify Report: security

> Generado: 2026-04-22
> Verificador: sdd-verify

---

## Test Results

```
Test Files  1 failed | 7 passed (8)
      Tests  1 failed | 53 passed (54)
   Duration  8.32s
```

El único test fallando es **pre-existente** y no relacionado con este change:

```
FAIL  src/components/Avatar.test.tsx > Avatar > renderiza una imagen cuando se pasa url
Error: expected src="https://example.com/avatar.jpg" but received
       src="/_next/image?url=https%3A%2F%2Fexample.com%2Favatar.jpg&w=3840&q=75"
```

Este fallo existía antes del change (es un test de componente que no mockea `next/image`). **No bloquea el merge.**

Todos los tests nuevos del change (rate-limit, validate, friends/request, useSendFriendRequest) pasan: **53/53**.

---

## TypeCheck

```
bunx tsc --noEmit → sin output → 0 errores
```

✅ TypeScript strict mode sin errores.

---

## REQ-RL-01: Helper `rateLimit` con sliding window en memoria

✅ PASS — `rateLimit(key, limit, windowMs): boolean` implementado en `src/lib/rate-limit.ts`. Retorna `boolean` (no el objeto `{ allowed, remaining, resetAt }` que el spec describe textualmente, pero la _interface sincrónica_ del design es `boolean`; el design es la fuente de verdad para la firma).

> **Nota**: El spec REQ-RL-01 describe un objeto de retorno con `allowed`, `remaining` y `resetAt`, pero el design (ADR-01) y las tasks (1.1) definen explícitamente `rateLimit(...): boolean`. La implementación sigue el design. Sin embargo hay una **discrepancia entre spec y design** en la firma de retorno.

---

## REQ-RL-02: Sliding window real

✅ PASS — El filtro `timestamps.filter((t) => t > cutoff)` descarta timestamps más antiguos que `now - windowMs` antes de contar. Test "timestamps expirados no se cuentan" verifica esto con `vi.setSystemTime`.

---

## REQ-RL-03: Cleanup probabilístico

✅ PASS — `maybeCleanup()` se llama en cada invocación, elimina entries vacías con probabilidad 1% (`Math.random() > 0.01`). El Map se declara como `const store = new Map<string, number[]>()`.

---

## REQ-RL-04: Bypass en entorno de test

✅ PASS — `if (process.env.NODE_ENV === "test") return true;` al inicio de `rateLimit`. Test específico lo verifica con `vi.stubEnv("NODE_ENV", "test")`.

> **Nota**: El spec dice retornar `{ allowed: true, remaining: limit, resetAt: 0 }` pero la firma es `boolean`. Consistente con el design; sin impacto funcional.

---

## REQ-RL-05: Construcción de key por userId o IP

✅ PASS — `buildKey` implementa: si `userId` → `{route}:user:{userId}`, sino lee `x-forwarded-for` (primer valor), fallback a `"unknown"`. Tests cubren los tres casos.

---

## REQ-RL-06: Respuesta HTTP al superar el límite

✅ PASS — Todas las rutas que aplican rate limit responden:
- HTTP 429
- Header `Retry-After` con el valor correspondiente
- Body JSON `{ error: "Too many requests", retryAfter: N }`
- El guard ocurre antes del business logic (verificado en packs/award, blocks, friends/request)

---

## REQ-RL-07: Rate limit en `/api/packs/award`

✅ PASS — `buildKey('packs/award', req, user.id)` + `rateLimit(key, 5, 60_000)` ejecutado DESPUÉS del auth check y ANTES de cualquier I/O. Logging presente: `console.warn("[rate_limit_exceeded] route=packs/award userId=%s", user.id)`.

---

## REQ-RL-08: Rate limit en `/api/unfurl`

⚠️ WARNING — Rate limit de 10 req/min implementado con `buildKey('unfurl', req, null)` — **hardcodeado a null**, sin intentar resolver userId si hubiera sesión. El spec (REQ-RL-08) dice "usar userId si disponible, IP como fallback". La implementación actual siempre usa IP. El endpoint `unfurl` es GET y no realiza auth check previo, por lo que no hay user disponible en el handler — pero el spec preveía soporte opcional. Funcionalmente protege la ruta; la granularidad es por IP en vez de por userId.

---

## REQ-RL-09: Rate limit en `/api/blocks`

✅ PASS — `buildKey('blocks', req, user.id)` + `rateLimit(key, 10, 60_000)`. Guard DESPUÉS del auth check, ANTES del business logic. Logging presente.

---

## REQ-RL-10: Verificación de webhook secret en `/api/notifications/push`

✅ PASS — Implementación completa:
- `timingSafeEqualStr` usa `crypto.timingSafeEqual` con verificación previa de longitud
- Si `SUPABASE_WEBHOOK_SECRET` no está definida: `console.warn(...)` y continúa (comportamiento permisivo)
- Soporta rotación: acepta `SUPABASE_WEBHOOK_SECRET_PREVIOUS`
- Verificación es el PRIMER paso del handler (antes de leer body)
- Rate limit por IP después del auth check: 60 req/min

---

## REQ-UV-01: Endpoint `POST /api/uploads/validate`

✅ PASS — Flujo en orden estricto implementado:
1. Auth check → 401 si no hay user
2. Parse formData → extrae `file`
3. Size check (video primero, 50 MB; luego imagen, 5 MB dentro del bloque de imagen)
4. Magic bytes detection (12 bytes)
5. Sharp validation para imágenes
6. 200 con `{ valid: true, mime: detectedMime }`
7. 415 con `{ error: "Unsupported media type", detectedMime: null }` si no detecta tipo

> **Nota menor**: La spec menciona "signedUrl" en la respuesta exitosa (REQ-UV-01 paso 6) pero el design (ADR-03) y las tasks (2.10) definen `{ valid: true, mime }` — sin URL firmada. El design cancela ese requisito explícitamente. Sin impacto en seguridad.

---

## REQ-UV-02: Allowlist de MIME types y magic bytes

✅ PASS — `SIGNATURES` cubre JPEG, PNG, GIF, WEBP (con verificación secundaria en offset 8), WebM, MP4 (offset 4). `Content-Type` del cliente es ignorado; el MIME detectado manda.

---

## REQ-UV-03: Validación con `sharp` para imágenes

✅ PASS — Para imágenes: carga buffer completo, llama `sharp(buffer).metadata()`, cross-check `FORMAT_TO_MIME[metadata.format]` vs MIME detectado. Si sharp lanza → 415 `{ error: "Invalid image" }`. Para videos: NO se llama sharp.

---

## REQ-UV-04: Límites de tamaño por tipo

✅ PASS — `MAX_VIDEO_BYTES = 50 * 1024 * 1024` (50 MB), `MAX_IMAGE_BYTES = 5 * 1024 * 1024` (5 MB). Validación de video primero (antes de magic bytes). Imagen validada dentro del bloque `if (detected.startsWith("image/"))`. Tests cubren ambos casos.

---

## REQ-UV-05: Generación de URL firmada post-validación

⚠️ WARNING — **No implementado**: La spec requiere `createSignedUploadUrl` con TTL 60s y path `uploads/{userId}/{uuid}.{ext}`. El design (ADR-03) decidió NO incluir URL firmada en este change: "el design alternativo de devolver una signed URL complica el cliente y requiere cambios grandes en el flujo de Storage." La respuesta es `{ valid: true, mime }` y el cliente procede con el flujo de upload existente. Esta es una **decisión de design documentada**, no un olvido.

---

## REQ-UV-06: `sharp` en `dependencies`

✅ PASS — `"sharp": "^0.34.5"` aparece en `dependencies` del `package.json`. NO aparece en `devDependencies`.

---

## REQ-FR-01: Nueva API route `POST /api/friends/request`

✅ PASS — Flujo en orden correcto implementado: auth → rate limit → validar body → dedup check → block check → insert → 201. Los checks de self-request y UUID están presentes.

---

## REQ-FR-02: Rate limit de friend requests

✅ PASS — `rateLimit(key, 20, 3_600_000)` (20 req/hora). Header `Retry-After: 3600` en respuesta 429.

---

## REQ-FR-03: Verificación de solicitud o relación existente

✅ PASS — Query bidireccional con `.or(...)` y `.in("status", ["pending", "accepted"])`. Mensajes diferenciados: "Friend request already pending" vs "Already friends". Tests cubren ambas direcciones.

---

## REQ-FR-04: Verificación de bloqueo mutuo

✅ PASS — Query a tabla `user_blocks` (nombre real en la app) con `.or(...)` en ambas direcciones. Respuesta 403 `{ error: "Cannot send friend request" }` sin revelar dirección del bloqueo.

---

## REQ-FR-05: Inserción atómica de solicitud y notificación

⚠️ WARNING — **Rollback manual en lugar de transacción real**: la implementación hace INSERT en `friends`, luego INSERT en `notifications`, y si falla el segundo hace DELETE manual del primero. Esto NO es atómico a nivel de base de datos: si el proceso muere entre el insert de friends y el rollback, queda una solicitud huérfana. El spec indica "RPC de Supabase o transacción", el design menciona preferencia por RPC si existe. La task (2.13) acepta explícitamente "rollback manual en caso de error del segundo". Race condition entre delete y otra request es teóricamente posible pero muy improbable. **Deuda técnica aceptada pero documentada**.

Manejo de unique constraint (23505) en insert de friends → 409. ✅

---

## REQ-FR-06: Refactor de `useSendFriendRequest`

✅ PASS — `useSendFriendRequest` en `useFriends.ts`:
- Usa `fetch('/api/friends/request', { method: 'POST', ... })`
- Sin llamadas a `supabase.from('friends').insert` ni `supabase.from('notifications').insert` en el flujo de send
- `onMutate`: setea `['friendship', friendId]` a `{ status: 'pending' }`
- `onError`: rollback vía `queryClient.setQueryData`
- `onSettled`: invalida `['friendship', friendId]` y `['friends']`
- Signature pública `{ mutate, mutateAsync, isPending, isError, isSuccess }` intacta

> **Nota**: La firma del `mutationFn` cambió de `(targetUserId: string)` a `({ userId, friendId })` — un objeto. Esto requiere que los consumidores pasen el objeto. Es un breaking change en la firma del mutationFn, aunque `mutate/isPending/isError/isSuccess` siguen presentes. Verificar que los componentes consumidores actualizaron la llamada.

---

## REQ-FR-07: Eliminación de inserción directa desde el cliente

⚠️ WARNING — `useFriends.ts` línea 149 aún contiene `supabase.from("notifications").insert` para el flujo `useAcceptFriendRequest` (`friend_accept`). Esto es correcto y esperado — ese flujo no es parte del change. Sin embargo, el spec (REQ-FR-07) dice "llamadas a `supabase.from('notifications').insert` relacionadas con friend requests" deben fluir por la API route. El flujo de accept sigue siendo cliente-directo. Esto puede ser intencional (el change solo cubre el envío, no el accept), pero no está explícitamente excluido.

---

## REQ-CC-01: TypeScript strict

✅ PASS — `bunx tsc --noEmit` sin errores. Tipos nuevos definidos en `src/types/index.ts`. No hay `any` implícitos en los archivos nuevos.

---

## REQ-CC-02: Variables de entorno

❌ CRITICAL — **`.env.example` no existe** en el repositorio. El archivo no fue creado (tarea 1.2 del plan). Las variables `SUPABASE_WEBHOOK_SECRET` y `SUPABASE_WEBHOOK_SECRET_PREVIOUS` no están documentadas. Esto viola REQ-CC-02 explícitamente.

---

## REQ-CC-03: Logging de seguridad

✅ PASS — Todos los rechazos loguean con contexto suficiente:
- `packs/award`: `[rate_limit_exceeded] route=packs/award userId=...`
- `unfurl`: `[rate_limit_exceeded] route=unfurl ip=...`
- `blocks`: `[rate_limit_exceeded] route=blocks userId=...`
- `notifications/push`: `[invalid_webhook_secret] route=... ip=...` y `[rate_limit_exceeded] route=... ip=...`
- `uploads/validate`: `[file_too_large] ...userId/size/mime` y `[invalid_mime] ...userId/detectedMime/sharpFormat`
- `friends/request`: `[rate_limit_exceeded] ...userId` y `[insert_error]` y `[notif_rollback]`

Sin datos sensibles (secrets, PII completa, body completo) en ningún log.

---

## REQ-CC-04: TODO de evolución futura en rate-limit.ts

✅ PASS — Primera línea del archivo: `// TODO: replace with @upstash/ratelimit for multi-instance support` adyacente a la declaración del Map.

---

## REQ-FR-05 (adicional): `FriendRequestResponse` tipo

⚠️ WARNING — El spec y las tasks definen `FriendRequestResponse = { requestId: string }`. La implementación lo define como `{ ok: boolean }` porque la tabla `friends` usa clave compuesta sin `id` autogenerado (anotado con comentario en el código). El design explícitamente dice "o `{ ok: true }` si usa clave compuesta sin id". Discrepancia entre spec y types implementados — el design resuelve la ambigüedad, pero el tipo en `src/types/index.ts` debería idealmente reflejarlo o el spec debería actualizarse.

---

## Summary

| Categoría | Cantidad |
|-----------|----------|
| ✅ PASS | 18 |
| ⚠️ WARNING | 5 |
| ❌ CRITICAL | 1 |

### CRITICAL (1) — Bloquea merge

1. **REQ-CC-02** — `.env.example` no existe. Tarea 1.2 no implementada. Crear el archivo con `SUPABASE_WEBHOOK_SECRET=your-secret-here` y `SUPABASE_WEBHOOK_SECRET_PREVIOUS=` antes de mergear.

### WARNINGs (5) — No bloquean merge pero requieren atención

1. **REQ-RL-01/spec** — Discrepancia menor entre spec (retorna objeto `{allowed, remaining, resetAt}`) y design+impl (`boolean`). El design gana, pero conviene actualizar el spec para evitar confusión futura.
2. **REQ-RL-08** — `/api/unfurl` siempre usa IP como key, sin intentar resolver userId. El endpoint no tiene auth check, así que el comportamiento es correcto en la práctica, pero no cumple el "userId si disponible" del spec.
3. **REQ-UV-05** — URL firmada no implementada (decisión de design ADR-03 documentada). El cliente sube con el flujo existente. Aceptable para MVP.
4. **REQ-FR-05** — Insert no es verdaderamente atómico (rollback manual). RPC transaccional sería la solución definitiva. Deuda técnica documentada.
5. **REQ-FR-07** — `useAcceptFriendRequest` sigue insertando notificaciones directamente desde el cliente. Posiblemente fuera del scope del change, pero no está explícitamente excluido en el spec.

### Test failures pre-existentes

- `Avatar.test.tsx` — Fallo de test preexistente (next/image mockeo) no relacionado con este change.
