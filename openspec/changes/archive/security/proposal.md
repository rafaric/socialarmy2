# Proposal: security

## Intent

El codebase tiene tres vectores de abuso activos que pueden ser explotados sin requerir vulnerabilidades sofisticadas:

1. **Rutas API sin rate limit**: endpoints críticos como `/api/packs/award`, `/api/unfurl`, `/api/blocks`, y en particular el webhook `/api/notifications/push` (que no verifica origen Supabase) pueden ser invocados ilimitadamente por cualquier cliente. El webhook de push es el más grave: permite a cualquiera con la URL disparar notificaciones push masivas.
2. **Uploads sin validación server-side**: los archivos suben directo del browser a Supabase Storage usando la anon key. `file.type` es falsificable (se basa en extensión) y no hay verificación de magic bytes. Un atacante puede subir ejecutables o payloads disfrazados.
3. **Spam de friend requests desde el cliente**: `useSendFriendRequest()` inserta notificaciones directo desde el browser sin pasar por API route, sin rate limit, y sin chequear solicitudes pendientes. Permite spam trivial de notificaciones a cualquier usuario.

Este change cierra los tres huecos antes de que el producto escale. Los reportes de contenido quedan fuera de scope y se tratarán en un change separado.

## Scope

### In scope

- Helper `src/lib/rate-limit.ts` con sliding window en memoria (Map-based) reutilizable desde cualquier API route.
- Aplicar rate limit a `/api/packs/award`, `/api/unfurl`, `/api/blocks`, `/api/notifications/push`.
- Verificación de origen (firma o secret) en el webhook `/api/notifications/push` para rechazar llamadas que no provengan de Supabase.
- Nueva ruta `/api/uploads/validate` que valida magic bytes de los archivos y autoriza la subida (o devuelve URL firmada).
- Mover `sharp` de `devDependencies` a `dependencies` en `package.json`.
- Nueva ruta `/api/friends/request` que encapsula la lógica de solicitud: rate limit + check de solicitud pendiente/existente + inserción de notificación.
- Refactor de `useSendFriendRequest()` para consumir la API route en lugar de insertar directo en Supabase.
- Tipos TypeScript para payloads de las nuevas rutas en `src/types/index.ts`.

### Out of scope

- Sistema de reportes de contenido (change separado posterior).
- Rate limiting distribuido multi-instancia (Upstash/Redis). Se deja documentado como evolución futura: el Map en memoria alcanza para Vercel serverless por instancia, con ventana corta.
- Antivirus o sandbox real para uploads (solo validación de magic bytes + content-type).
- Captcha, 2FA, o verificación de email.
- Auditoría completa de otras API routes fuera de las identificadas.
- Bloqueo de cuentas / ban system.

## Approach

### Feature 1: Rate Limiting

**Decisión: Map en memoria con sliding window, no Upstash en este change.**

- `src/lib/rate-limit.ts` expone `rateLimit(key, { limit, windowMs })` que retorna `{ allowed: boolean, remaining: number, resetAt: number }`.
- La key se construye típicamente como `${routeName}:${userId ?? ip}`. Si no hay user autenticado, usar IP (`x-forwarded-for` o `request.ip`).
- Implementación: `Map<string, number[]>` donde el valor es el array de timestamps de requests dentro de la ventana. En cada llamada se filtran los timestamps vencidos y se cuenta el resto.
- Se agrega cleanup opcional (cada N requests se purgan las keys vacías) para evitar leaks.
- Las rutas que excedan el límite retornan `429 Too Many Requests` con header `Retry-After`.

**Límites propuestos** (ajustables):
- `/api/packs/award`: 10 req/min por usuario.
- `/api/unfurl`: 30 req/min por usuario (es mas permisivo porque se llama al componer).
- `/api/blocks`: 20 req/min por usuario.
- `/api/notifications/push`: 60 req/min por IP + verificación de firma.
- `/api/friends/request`: 10 req/min por usuario.

**Seguridad del webhook `/api/notifications/push`**:
- Leer `SUPABASE_WEBHOOK_SECRET` de env y comparar contra el header que Supabase envía al configurar el webhook (`Authorization: Bearer <secret>` o header custom).
- Si el secret no coincide, retornar `401` antes de hacer cualquier trabajo.
- Documentar el secret en `.env.example` y en el README de setup.

**Trade-off reconocido**: Map en memoria no sobrevive entre instancias de Vercel ni entre cold starts. Para el MVP es aceptable — un atacante persistente puede rotar ventanas, pero el 90% del abuso casual queda bloqueado. Se deja un `TODO` señalando @upstash/ratelimit como siguiente iteración cuando haya tráfico real.

### Feature 2: Upload validation

**Decisión: validación server-side con sharp + magic bytes antes de autorizar la subida.**

- Mover `sharp` de `devDependencies` a `dependencies` para que esté disponible en runtime serverless.
- Nueva ruta `POST /api/uploads/validate`:
  - Recibe el archivo como `multipart/form-data` o como `ArrayBuffer` en el body.
  - Lee los primeros bytes (8-16 bytes alcanzan) y verifica los magic numbers contra una allowlist: `image/jpeg` (`FF D8 FF`), `image/png` (`89 50 4E 47`), `image/webp` (`52 49 46 46 ... 57 45 42 50`), `image/gif` (`47 49 46 38`).
  - Opcionalmente usa `sharp` para intentar decodificar la imagen y validar que es una imagen real (no solo header falsificado con payload detrás).
  - Si pasa, retorna URL firmada de Supabase Storage (`createSignedUploadUrl`) con TTL corto (ej. 60s) — el cliente sube directo con esa URL.
  - Si falla, retorna `400` con motivo.
- El cliente (`src/components/...` que maneja uploads) deja de subir directo: primero llama al endpoint de validación y recibe la URL firmada.
- Tamaño máximo validado server-side (ej. 5 MB imágenes, 10 MB otros) — rechazar antes de cualquier procesamiento pesado.

**Trade-off reconocido**: agregar un round-trip al flujo de upload. Aceptable porque evita toda una categoría de abuso (subir ejecutables, bypasses de content-type). Si la latencia molesta, la alternativa es validar con Supabase Edge Functions — más complejo pero en la misma red que Storage.

### Feature 3: Friend request spam

**Decisión: mover la lógica a API route, nunca insertar notificaciones desde el cliente.**

- Nueva ruta `POST /api/friends/request`:
  - Autentica con `createClient()` server-side, valida que hay user.
  - Aplica rate limit (10 req/min por user).
  - Valida que el `target_user_id` exista y sea distinto del caller.
  - Verifica que no exista una solicitud **pendiente o aceptada** entre ambos usuarios (query contra la tabla de friendships/friend_requests).
  - Verifica que no haya bloqueo mutuo.
  - Usa admin client para insertar la solicitud + la notificación de forma atómica (idealmente una RPC/transaction en Supabase para evitar estados inconsistentes).
  - Retorna `201` con el ID de la solicitud o `409` si ya existía.
- `useSendFriendRequest()` se refactoriza: ahora llama a `fetch('/api/friends/request', ...)` en lugar de insertar directo con supabase-js. React Query maneja el mutation state igual que antes.
- Si hay un hook o componente que inserta notificaciones directo para otros casos, queda fuera de scope — este change solo cubre friend requests.

**Trade-off reconocido**: perdemos optimistic updates "gratis" que daba la inserción directa. Mitigación: implementar optimistic update en el mutation de React Query (`onMutate` + rollback en `onError`). Código marginalmente más largo pero seguro.

## Affected modules

**Nuevos archivos**:
- `src/lib/rate-limit.ts` — helper de rate limiting.
- `src/app/api/uploads/validate/route.ts` — endpoint de validación de uploads.
- `src/app/api/friends/request/route.ts` — endpoint de solicitud de amistad.

**Modificados**:
- `src/app/api/packs/award/route.ts` — aplicar `rateLimit()`.
- `src/app/api/unfurl/route.ts` — aplicar `rateLimit()`.
- `src/app/api/blocks/route.ts` — aplicar `rateLimit()`.
- `src/app/api/notifications/push/route.ts` — verificación de secret + rate limit por IP.
- `src/hooks/useSendFriendRequest.ts` (o path equivalente) — refactor para usar API route.
- Componente/s que suben archivos a Supabase Storage — usar el nuevo flujo de validación.
- `src/types/index.ts` — tipos para payloads de las nuevas rutas.
- `package.json` — mover `sharp` a `dependencies`.
- `.env.example` — agregar `SUPABASE_WEBHOOK_SECRET`.

## Rollback plan

Cada feature es independiente y se aplica en commits separados, por lo que el rollback es granular:

1. **Rate limiting**: si un límite resulta demasiado agresivo, ajustar el número en la llamada a `rateLimit()` — no requiere rollback estructural. En caso extremo, un `if (false && !allowed)` deshabilita el check sin remover el código.
2. **Webhook secret**: si Supabase deja de autenticar correctamente, un feature flag (`process.env.DISABLE_WEBHOOK_AUTH === 'true'`) permite volver al comportamiento anterior mientras se diagnostica.
3. **Upload validation**: si la validación rompe uploads legítimos (ej. un formato que no consideramos), revertir el cliente al flujo directo es un single-commit revert. El endpoint queda pero sin uso.
4. **Friend request API route**: si la nueva ruta tiene un bug, el hook viejo puede mantenerse atrás de un feature flag (`NEXT_PUBLIC_USE_FRIEND_API=true`) durante una ventana de soft-launch. Después del soft-launch, eliminar el flag.

`git revert` a nivel de commit funciona para cualquiera de las features sin afectar las otras, porque los archivos tocados no se solapan (excepto `package.json` y `types/index.ts` — pero son edits aditivos).

## Risks

1. **Falsos positivos de rate limit en testing / CI**: si los tests hacen muchas requests rápidas contra las rutas, pueden gatillar el límite. **Mitigación**: detectar `process.env.NODE_ENV === 'test'` y bypassear, o usar IP/user específico en tests.

2. **Map en memoria crece sin límite**: si el cleanup falla, la Map acumula keys para siempre hasta que la instancia serverless se recicle. **Mitigación**: cleanup probabilístico en cada llamada (1% de probabilidad de purgar entries vencidas) + TTL implícito en el filtro de timestamps.

3. **Sharp en serverless**: `sharp` tiene binarios nativos pesados. Vercel soporta sharp, pero aumenta el bundle y el cold start. **Mitigación**: validar primero solo con magic bytes (cheap), usar sharp solo si pasa la primera verificación. Medir tamaño del bundle después del cambio.

4. **Race condition en friend request**: si dos requests concurrentes del mismo par (A→B y B→A) llegan al mismo tiempo, podemos crear solicitudes duplicadas. **Mitigación**: unique constraint en la tabla `(requester_id, target_id)` normalizada (menor de los dos IDs primero) + manejar el error de constraint violation como "ya existe".

5. **Webhook secret rotation**: si el secret rota y la env var no se actualiza a tiempo, el webhook cae. **Mitigación**: soportar dos secrets válidos durante la rotación (`SUPABASE_WEBHOOK_SECRET` y `SUPABASE_WEBHOOK_SECRET_PREVIOUS`), documentar el procedimiento.

6. **URL firmada de upload interceptada**: el cliente recibe la URL firmada y podría dársela a un tercero. **Mitigación**: TTL corto (60s), la URL solo permite subir al path específico del user, y en caso extremo se puede asociar la URL a la session del user vía un token adicional.

7. **Breaking change en `useSendFriendRequest`**: componentes que lo consumen pueden depender de internals que cambian. **Mitigación**: mantener la misma signature pública del hook (`{ mutate, isPending, isError }`), solo cambiar la implementación.
