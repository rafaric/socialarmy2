# Spec: security

> Change: security
> Status: draft
> Date: 2026-04-22

---

## Feature 1: Rate Limiting

### REQ-RL-01: Helper `rateLimit` con sliding window en memoria

**Given** que una API route necesita limitar la frecuencia de requests
**When** se invoca `rateLimit(key, { limit, windowMs })`
**Then** el helper MUST retornar un objeto `{ allowed: boolean, remaining: number, resetAt: number }`
- `allowed` es `true` si el número de requests en la ventana actual es menor que `limit`
- `remaining` es `limit - count` donde `count` son los requests vigentes en la ventana
- `resetAt` es el timestamp Unix (ms) del request más antiguo dentro de la ventana + `windowMs`

### REQ-RL-02: Sliding window real (no fixed window)

**Given** que se realizan requests en el tiempo
**When** un timestamp registrado en el Map interno es más antiguo que `Date.now() - windowMs`
**Then** ese timestamp MUST ser descartado antes de contar el total
**And** el conteo MUST reflejar únicamente los requests ocurridos dentro de la ventana deslizante activa

### REQ-RL-03: Cleanup probabilístico para prevenir memory leaks

**Given** que la instancia serverless procesa muchos keys distintos en el tiempo
**When** se invoca `rateLimit` con cualquier key
**Then** el helper SHOULD ejecutar un cleanup probabilístico (probabilidad default 1%) que elimina del Map las entries cuyo array de timestamps quedó vacío tras el filtro de ventana
**And** el Map interno MUST ser declarado con un comentario `// TODO: replace with @upstash/ratelimit for multi-instance support`

### REQ-RL-04: Bypass en entorno de test

**Given** que el entorno de ejecución tiene `NODE_ENV === 'test'`
**When** se invoca `rateLimit`
**Then** el helper MUST retornar siempre `{ allowed: true, remaining: limit, resetAt: 0 }` sin modificar el Map, para no causar falsos positivos en CI ni contaminar tests paralelos

### REQ-RL-05: Construcción de key por userId o IP

**Given** que una ruta tiene usuario autenticado
**When** se construye la key para `rateLimit`
**Then** la key MUST tener formato `{routeName}:{userId}` (ej. `packs-award:uuid-123`)

**Given** que una ruta no tiene usuario autenticado o es un webhook IP-based
**When** se construye la key para `rateLimit`
**Then** la key MUST usar la IP del cliente leyendo en orden: header `x-forwarded-for` (primer valor), `request.ip`, o el literal `"unknown"` como fallback

### REQ-RL-06: Respuesta HTTP al superar el límite

**Given** que una request supera el límite configurado para su ruta
**When** `rateLimit` retorna `{ allowed: false }`
**Then** la route handler MUST responder con HTTP 429 Too Many Requests
**And** la respuesta MUST incluir el header `Retry-After` con los segundos hasta que se resetea la ventana (calculado como `Math.ceil((resetAt - Date.now()) / 1000)`)
**And** el body MUST ser JSON con estructura `{ error: "Too many requests", retryAfter: number }`
**And** la verificación de rate limit MUST ocurrir ANTES de cualquier business logic de la ruta

### REQ-RL-07: Rate limit en `/api/packs/award`

**Given** que un usuario autenticado llama a `POST /api/packs/award`
**When** el usuario ha realizado 5 o más requests en los últimos 60 segundos
**Then** la ruta MUST responder con HTTP 429

**Given** que un usuario autenticado llama a `POST /api/packs/award`
**When** el usuario ha realizado menos de 5 requests en los últimos 60 segundos
**Then** la ruta MUST procesar la request normalmente

> Límite: 5 req/min por userId

### REQ-RL-08: Rate limit en `/api/unfurl`

**Given** que un cliente llama a `/api/unfurl`
**When** el usuario/IP ha realizado 10 o más requests en los últimos 60 segundos
**Then** la ruta MUST responder con HTTP 429

**Given** que el endpoint se usa con usuario autenticado
**When** se construye la key
**Then** la key SHOULD usar userId si está disponible, IP como fallback

> Límite: 10 req/min por userId o IP

### REQ-RL-09: Rate limit en `/api/blocks`

**Given** que un usuario autenticado llama a `/api/blocks`
**When** el usuario ha realizado 10 o más requests en los últimos 60 segundos
**Then** la ruta MUST responder con HTTP 429

> Límite: 10 req/min por userId

### REQ-RL-10: Verificación de webhook secret en `/api/notifications/push`

**Given** que llega una request a `POST /api/notifications/push`
**When** la variable de entorno `SUPABASE_WEBHOOK_SECRET` está definida
**Then** la ruta MUST verificar que el header `x-webhook-secret` de la request coincide exactamente con `SUPABASE_WEBHOOK_SECRET` usando comparación de tiempo constante (`timingSafeEqual`) para prevenir timing attacks
**And** si el header está ausente o no coincide, la ruta MUST responder con HTTP 401 y body `{ error: "Unauthorized" }` ANTES de ejecutar cualquier business logic

**Given** que llega una request a `POST /api/notifications/push`
**When** la variable de entorno `SUPABASE_WEBHOOK_SECRET` NO está definida
**Then** la ruta SHOULD emitir un `console.warn` indicando que el webhook no está protegido, y continuar procesando (comportamiento permisivo para desarrollo local)

**Given** que se necesita rotar el webhook secret sin downtime
**When** `SUPABASE_WEBHOOK_SECRET_PREVIOUS` está definida además de `SUPABASE_WEBHOOK_SECRET`
**Then** la ruta MUST aceptar requests que coincidan con CUALQUIERA de los dos secrets

---

## Feature 2: Upload Validation

### REQ-UV-01: Endpoint `POST /api/uploads/validate`

**Given** que un cliente autenticado quiere subir un archivo
**When** realiza `POST /api/uploads/validate` con el archivo como `multipart/form-data` (campo `file`)
**Then** el endpoint MUST ejecutar los siguientes pasos en orden:
1. Verificar que el usuario está autenticado — responder 401 si no lo está, antes de leer ningún byte
2. Verificar que el tamaño del archivo no supera el límite según su tipo (ver REQ-UV-04)
3. Leer los primeros 16 bytes y detectar el MIME type real por magic bytes
4. Verificar que el MIME type detectado está en la allowlist (ver REQ-UV-02)
5. Si es imagen, validar con `sharp` (ver REQ-UV-03)
6. Si pasa todo, retornar HTTP 200 con `{ signedUrl: string, path: string }`
7. Si falla la validación de tipo, retornar HTTP 415 con `{ error: "Unsupported media type", detectedMime: string }`

### REQ-UV-02: Allowlist de MIME types y magic bytes

**Given** que se reciben los primeros bytes de un archivo
**When** se determina el tipo real del contenido
**Then** la implementación MUST validar los magic bytes contra la siguiente tabla y MUST rechazar con 415 cualquier tipo que no esté en ella:

| MIME type  | Magic bytes (hex)                                        |
|------------|----------------------------------------------------------|
| image/jpeg | `FF D8 FF`                                               |
| image/png  | `89 50 4E 47 0D 0A 1A 0A`                               |
| image/gif  | `47 49 46 38 37 61` o `47 49 46 38 39 61`               |
| image/webp | `52 49 46 46 ?? ?? ?? ?? 57 45 42 50` (RIFF....WEBP)    |
| video/mp4  | bytes 4–7 = `66 74 79 70` (ftyp box)                    |
| video/webm | `1A 45 DF A3`                                            |

**Given** que el campo `Content-Type` del multipart difiere del tipo detectado por magic bytes
**When** se decide qué tipo usar
**Then** la implementación MUST usar el tipo detectado por magic bytes e ignorar el `Content-Type` declarado por el cliente

### REQ-UV-03: Validación adicional con `sharp` para imágenes

**Given** que los magic bytes coinciden con un tipo de imagen (jpeg, png, gif, webp)
**When** se procesa el buffer con `sharp`
**Then** la implementación SHOULD invocar `sharp(buffer).metadata()` para verificar que el archivo es una imagen real y no solo un header válido con payload arbitrario detrás
**And** si `sharp` lanza una excepción, la respuesta MUST ser HTTP 415

**Given** que el archivo es de tipo video (mp4, webm)
**When** se decide si usar `sharp`
**Then** `sharp` NO DEBE invocarse; la validación se limita a los magic bytes

### REQ-UV-04: Límites de tamaño por tipo

**Given** que un cliente sube un archivo a `/api/uploads/validate`
**When** el tamaño del archivo supera el límite correspondiente:
- Imágenes: más de 5 MB
- Videos: más de 50 MB
**Then** el endpoint MUST rechazar con HTTP 413 y body `{ error: "File too large", maxBytes: number }`
**And** esta validación MUST ocurrir ANTES de la inspección de magic bytes para evitar procesamiento innecesario

### REQ-UV-05: Generación de URL firmada post-validación

**Given** que un archivo pasa todas las validaciones
**When** se genera la respuesta exitosa
**Then** la implementación MUST generar una URL firmada usando `createSignedUploadUrl` del cliente admin de Supabase
**And** la URL firmada MUST tener un TTL de 60 segundos
**And** el path de destino MUST tener formato `uploads/{userId}/{uuid}.{ext}` donde `{ext}` se deriva del MIME type detectado, no de la extensión original del nombre del archivo
**And** el cliente NO puede especificar el path de destino (el servidor lo construye para prevenir path traversal)

### REQ-UV-06: `sharp` en `dependencies`

**Given** que `sharp` se usa en runtime serverless para validación de imágenes
**When** se lee `package.json`
**Then** `sharp` MUST aparecer en la sección `dependencies`, no en `devDependencies`
**And** la versión MUST ser la misma que estaba en `devDependencies` previamente, sin downgrade

---

## Feature 3: Friend Request Anti-Spam

### REQ-FR-01: Nueva API route `POST /api/friends/request`

**Given** que un usuario quiere enviar una solicitud de amistad
**When** realiza `POST /api/friends/request` con body `{ targetUserId: string }`
**Then** la ruta MUST ejecutar los siguientes pasos en orden:
1. Verificar autenticación — responder 401 si no hay sesión válida
2. Aplicar rate limit de 20 req/hora por userId (ver REQ-FR-02)
3. Validar que `targetUserId` está presente y es un UUID válido — 400 si falla
4. Verificar que `targetUserId` es distinto del userId del caller — 400 con `{ error: "Cannot send friend request to yourself" }`
5. Verificar que no existe solicitud o relación previa (ver REQ-FR-03)
6. Verificar que no existe bloqueo mutuo (ver REQ-FR-04)
7. Insertar solicitud y notificación de forma atómica (ver REQ-FR-05)
8. Retornar HTTP 201 con `{ requestId: string }`

### REQ-FR-02: Rate limit de friend requests

**Given** que un usuario autenticado llama a `POST /api/friends/request`
**When** el usuario ha enviado 20 o más solicitudes en la última hora (ventana de 3600 segundos)
**Then** la ruta MUST responder con HTTP 429 y header `Retry-After`

**Given** que el usuario ha enviado menos de 20 solicitudes en la última hora
**When** se procesa la solicitud
**Then** el contador de rate limit MUST incrementarse en 1 antes de continuar con los checks siguientes

> Límite: 20 req/hora por userId

### REQ-FR-03: Verificación de solicitud o relación existente

**Given** que el caller (userId A) quiere enviar una solicitud al target (userId B)
**When** ya existe una fila en la tabla `friends` con status `pending` donde `(requester_id = A AND target_id = B)` o `(requester_id = B AND target_id = A)`
**Then** la ruta MUST responder con HTTP 409 y body `{ error: "Friend request already pending" }`
**And** NO DEBE insertarse ninguna notificación nueva

**Given** que ya existe una fila en `friends` con status `accepted` entre A y B en cualquier dirección
**When** se evalúa la condición
**Then** la ruta MUST responder con HTTP 409 y body `{ error: "Already friends" }`

**Given** que no existe ninguna relación previa entre A y B
**When** se evalúa la condición
**Then** la ruta MAY proceder al check de bloqueo mutuo (REQ-FR-04)

### REQ-FR-04: Verificación de bloqueo mutuo

**Given** que existe un bloqueo en cualquier dirección entre el caller y el target
**When** se evalúa antes de insertar la solicitud
**Then** la ruta MUST responder con HTTP 403 y body `{ error: "Cannot send friend request" }` sin revelar si el bloqueo fue iniciado por el caller o por el target (privacidad del bloqueador)

### REQ-FR-05: Inserción atómica de solicitud y notificación

**Given** que todos los checks previos pasan
**When** se inserta la solicitud
**Then** la inserción en `friends` (status=pending) y la inserción de la notificación al target MUST ocurrir de forma atómica usando una RPC de Supabase o una transacción de base de datos
**And** si la inserción falla por violación de unique constraint (race condition), la ruta MUST manejar el error de constraint y responder con HTTP 409, idéntico al caso detectado por check previo

**Given** que la operación atómica es exitosa
**When** se retorna la respuesta
**Then** la ruta MUST responder con HTTP 201 y body `{ requestId: string }` donde `requestId` es el ID de la fila insertada en `friends`

### REQ-FR-06: Refactor de `useSendFriendRequest`

**Given** que el hook `useSendFriendRequest` actualmente inserta directo en Supabase desde el cliente
**When** se aplica el refactor de este change
**Then** el hook MUST llamar a `fetch('/api/friends/request', { method: 'POST', body: JSON.stringify({ targetUserId }) })` en lugar de cualquier llamada directa a `supabase.from('friends').insert(...)` o `supabase.from('notifications').insert(...)`

**Given** que el hook expone la signature pública `{ mutate, isPending, isError, isSuccess }`
**When** se refactoriza la implementación interna
**Then** la signature pública MUST mantenerse idéntica para no romper componentes consumidores

**Given** que el hook implementa optimistic updates
**When** la mutation falla con cualquier error HTTP (409, 429, 403, etc.)
**Then** el hook MUST hacer rollback del optimistic update usando `onError` en la configuración de la mutation de React Query

### REQ-FR-07: Eliminación de inserción directa desde el cliente

**Given** que la nueva API route está disponible
**When** se busca en el codebase cualquier llamada a `supabase.from('notifications').insert` relacionada con friend requests
**Then** esas llamadas MUST ser eliminadas del código cliente y la lógica MUST fluir únicamente por la API route

---

## Restricciones cross-cutting

### REQ-CC-01: TypeScript strict

**Given** que el proyecto usa TypeScript con strict mode
**When** se agregan los nuevos archivos y modificaciones
**Then** todos los nuevos tipos MUST definirse en `src/types/index.ts` o en los archivos de route correspondientes
**And** NO se permiten `any` implícitos ni casts sin justificación en código nuevo

### REQ-CC-02: Variables de entorno

**Given** que el webhook secret se lee de `process.env`
**When** se agrega `SUPABASE_WEBHOOK_SECRET` y `SUPABASE_WEBHOOK_SECRET_PREVIOUS`
**Then** ambas variables MUST estar documentadas en `.env.example` con valores placeholder y comentario explicativo
**And** la ausencia de `SUPABASE_WEBHOOK_SECRET` MUST loguear un warning pero NO romper el startup (comportamiento permisivo en dev)

### REQ-CC-03: Logging de seguridad

**Given** que ocurre un rechazo por rate limit, secret inválido, o validación de upload
**When** se genera la respuesta de error
**Then** la implementación SHOULD loguear el evento con contexto suficiente (ruta, userId/IP, motivo) para auditoría, sin incluir el body de la request ni datos sensibles

### REQ-CC-04: TODO de evolución futura en rate-limit.ts

**Given** que la implementación de rate limiting usa Map en memoria
**When** el archivo `src/lib/rate-limit.ts` es escrito
**Then** MUST incluir el comentario `// TODO: replace with @upstash/ratelimit for multi-instance support` adyacente a la declaración del Map

---

## Archivos afectados

| Archivo | Tipo de cambio |
|---------|----------------|
| `src/lib/rate-limit.ts` | Nuevo |
| `src/app/api/uploads/validate/route.ts` | Nuevo |
| `src/app/api/friends/request/route.ts` | Nuevo |
| `src/app/api/packs/award/route.ts` | Modificado — agregar `rateLimit` (5 req/min) |
| `src/app/api/unfurl/route.ts` | Modificado — agregar `rateLimit` (10 req/min) |
| `src/app/api/blocks/route.ts` | Modificado — agregar `rateLimit` (10 req/min) |
| `src/app/api/notifications/push/route.ts` | Modificado — secret check + `rateLimit` |
| `src/hooks/useSendFriendRequest.ts` | Modificado — refactor a API route |
| `src/types/index.ts` | Modificado — nuevos tipos de payload |
| `package.json` | Modificado — `sharp` a `dependencies` |
| `.env.example` | Modificado — `SUPABASE_WEBHOOK_SECRET` |
