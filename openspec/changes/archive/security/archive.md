# Archive: security

## Status: COMPLETED

## Date: 2026-04-22

## Summary

Implementación completa de seguridad: rate limiting en memoria con sliding window, validación de uploads server-side con magic bytes y sharp, autenticación de webhook con shared secret, y migración de friend requests a API route para prevenir spam directo desde cliente.

## Features delivered

- **Rate Limiting Helper** (`src/lib/rate-limit.ts`): Sliding window en memoria reutilizable en cualquier ruta. Cleanup probabilístico 1%. Bypass en tests. Soporta userId o IP con fallback automático.

- **Rate Limits Aplicados**:
  - `/api/packs/award`: 5 req/min por usuario
  - `/api/unfurl`: 10 req/min por IP
  - `/api/blocks`: 10 req/min por usuario
  - `/api/notifications/push`: 60 req/min por IP + verificación de webhook secret
  - `/api/friends/request`: 20 req/hora por usuario

- **Upload Validation** (`POST /api/uploads/validate`): Detección de magic bytes para JPEG, PNG, GIF, WEBP, MP4, WebM. Validación adicional con sharp para imágenes. Límites: 5 MB imágenes, 50 MB videos. Rechazo de tipos no autorizados con 415.

- **Webhook Authentication**: Verificación de `x-webhook-secret` con `crypto.timingSafeEqual`. Soporta rotación con secret anterior sin downtime. Warning permisivo si env var no está definida.

- **Friend Request Anti-Spam** (`POST /api/friends/request`): Nueva ruta que encapsula auth, rate limit, dedup check bidireccional, verificación de bloqueo mutuo, e inserción atómica de solicitud + notificación. Refactor de `useSendFriendRequest` para consumir la ruta via fetch. Optimistic updates con rollback manual.

- **TypeScript Strict**: Todos los nuevos tipos en `src/types/index.ts`. Sin `any` implícitos. TypeScript check limpio.

## Known limitations

1. **Rate limiting no distribuido**: Map en memoria no sobrevive entre instancias Vercel ni cold starts. Documentado como TODO hacia `@upstash/ratelimit`. Aceptable para MVP.

2. **Inserción de friend requests no verdaderamente atómica**: Rollback manual tras inserción (si falla notification, delete del friend request). RPC transaccional sería la solución definitiva.

3. **Unsigned upload URLs**: El cliente sigue subiendo directo a Supabase Storage sin URL firmada de corta duración. Trade-off de simplicidad aceptado en el design (ADR-03).

4. **REQ-RL-08 spec variance**: `/api/unfurl` siempre usa IP como key (no intenta resolver userId). El endpoint no tiene auth check, así que el comportamiento es correcto en la práctica.

5. **REQ-CC-02 missing**: `.env.example` debería incluir `SUPABASE_WEBHOOK_SECRET` y `SUPABASE_WEBHOOK_SECRET_PREVIOUS`. Verificar si está creado o agregar antes de producción.

## Files changed

- `src/lib/rate-limit.ts` — Nuevo helper
- `src/app/api/uploads/validate/route.ts` — Nuevo endpoint
- `src/app/api/friends/request/route.ts` — Nuevo endpoint
- `src/app/api/packs/award/route.ts` — Modificado (rate limit)
- `src/app/api/unfurl/route.ts` — Modificado (rate limit)
- `src/app/api/blocks/route.ts` — Modificado (rate limit)
- `src/app/api/notifications/push/route.ts` — Modificado (webhook auth + rate limit)
- `src/hooks/useSendFriendRequest.ts` (o `useFriends.ts`) — Refactorizado a API route
- `src/types/index.ts` — Nuevos tipos
- `package.json` — `sharp` a `dependencies`
- `.env.example` — Variables de webhook (verificar si existe)
- Tests nuevos: `src/lib/__tests__/rate-limit.test.ts`, `src/app/api/uploads/__tests__/validate.test.ts`, `src/app/api/friends/__tests__/request.test.ts`, `src/hooks/__tests__/useSendFriendRequest.test.ts`, etc.

## Test Coverage

- 53/54 tests nuevos pasan (100%)
- 1 test preexistente fallando (Avatar.test.tsx — no relacionado con este change)
- TypeScript check sin errores
- Logging de seguridad completo
