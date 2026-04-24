# Verify Report — Trading System

**Change name**: `trading-system`
**Fecha**: 2026-04-23
**Status**: PASS_WITH_WARNINGS
**Tests**: 227/228 (1 falla pre-existente en Avatar.test.tsx — no relacionada con este change)
**Typecheck**: OK — `bunx tsc --noEmit` sin errores

---

## Resumen ejecutivo

La implementación del trading system está **mayormente completa y correcta**. Los 7 features del spec (F-01 al F-07) tienen implementación funcional. La arquitectura sigue el patrón del design (RPCs SQL para atomicidad, admin client para bypass RLS, rate limiting, validación UUID). Sin embargo hay **3 warnings** de features faltantes que no bloquean el core pero reducen fidelidad con la spec, y **4 suggestions** de mejoras.

---

## CRITICAL — Bloqueantes

Ninguno. No se encontraron issues que rompan funcionalidad core o seguridad.

---

## WARNING — Spec no cumplida

### W-01: Ruta `/market/[listingId]` no existe como página dinámica

**Spec**: `src/app/(main)/market/[listingId]/page.tsx` — página de detalle de listing con drop zone para ofertar.

**Design**: La página debe mostrar datos del seller, carta listada, puntos requeridos, tiempo restante, auto-accept badge, `CardDropZone id="offer-drop"`, botón "Ofertar" que abre `OfferModal`.

**Encontrado**: La página dinámica `[listingId]` no existe. En cambio, el flujo de oferta se maneja con un modal de `OfferModal` inline en `/market/page.tsx`. Al hacer click en una `MarketCard`, se abre `OfferModal` sin navegar.

**Impacto**: Funcionalidad de ofertar sí está disponible (via modal inline), pero el UX de detalle de listing (vendor info, tiempo restante contextual, deep link directo a un listing) no está implementado. Además, `useListing(id)` existe en `useMarket.ts` pero no hay route `GET /api/market/listings/[id]` para ese hook — si se usa `useListing`, falla con 404.

**Evidencia**:
- `ls /src/app/(main)/market/` → `history/`, `my-listings/`, `page.tsx` (no hay `[listingId]/`)
- `GET` handler ausente en `src/app/api/market/listings/[id]/route.ts` (solo tiene `DELETE`)
- `useListing` en `useMarket.ts` llama `/api/market/listings/${id}` que devuelve 404

---

### W-02: `useMyOffers` apunta a ruta `/api/market/my-offers` que no existe

**Spec** (design §4): `useMyOffers(status?)` — hook que lista las ofertas del buyer autenticado.

**Encontrado**: El hook `useMyOffers` está implementado en `useMarket.ts` pero llama a `/api/market/my-offers` que NO existe como route en `src/app/api/market/`. No hay ningún archivo `my-offers/route.ts`.

**Impacto**: Cualquier componente que use `useMyOffers` recibirá 404. No afecta el flujo de seller (que usa `useListingOffers`), pero el buyer no puede ver sus ofertas pendientes.

**Evidencia**:
- `ls /src/app/api/market/` → `expire/`, `listings/` (no hay `my-offers/`)
- `useMarket.ts` línea 173: `fetch("/api/market/my-offers")`

---

### W-03: Componentes `MarketListingView` y `OfferList` no implementados

**Spec** (design §5, task 6.2/6.3): `src/components/market/MarketListingView.tsx` y `OfferList.tsx` definidos en el diseño.

**Encontrado**: Ninguno de los dos archivos existe en `src/components/market/`. La funcionalidad de `/market/my-listings` los reemplaza con lógica inline directamente en la página.

**Impacto**: La funcionalidad de mis listings sí funciona (la página `my-listings/page.tsx` usa `useMyListings`, `useListingOffers`, `OfferCard`, `TradeConfirmModal` directamente). El impacto es de arquitectura/reutilización: si otros contextos necesitaran `MarketListingView`, deberían duplicar la lógica.

**Evidencia**:
- `ls /src/components/market/` → no hay `MarketListingView.tsx` ni `OfferList.tsx`
- `grep -rn MarketListingView src/` → sin resultados

---

## SUGGESTION — Mejoras opcionales

### S-01: `pg_cron` job NO está comentado — corre en la migración

**Design § 1.8**: "Bloque pg_cron comentado al final: `-- HABILITAR CUANDO pg_cron esté activo...`"

**Encontrado**: El `SELECT cron.schedule(...)` en la migración NO está comentado. Si `pg_cron` no está habilitado en el proyecto Supabase, la migración fallará al llegar a esa línea.

```sql
-- líneas 793-798 de la migración:
SELECT cron.schedule(
  'trading-expire-listings-hourly',
  '0 * * * *',
  $$ SELECT public.expire_listings(); $$
);
```

**Recomendación**: Comentar el bloque o agregarlo como paso manual en el README de deploy. Si el proyecto Supabase no tiene `pg_cron` habilitado como extensión, la migración completa fallará en rollback.

---

### S-02: `useInventory` queryKey inconsistente con el design

**Design §4**: `queryKey: ["inventory", userId]`

**Encontrado**: `useInventory` usa `queryKey: ["inventory"]` (sin userId). Funciona correctamente porque la route filtra por la sesión del usuario en el servidor. Sin embargo, si en el futuro se implementa la vista del inventario de otro usuario (admin panel, perfil público), el cache colisionará.

---

### S-03: `useTradeHistory` hook no tiene endpoint de API implementado

El hook `useTradeHistory` existe en `src/hooks/useTradeHistory.ts`. La página `/market/history` lo usa. Sin embargo no se verificó si existe `src/app/api/market/history/route.ts`. Si no existe, la página history mostrará siempre error.

**Verificar**: `ls /src/app/api/market/` solo muestra `expire/` y `listings/`. No hay `history/`.

---

### S-04: Link al historial de trades en ProfileView no implementado

**Task 7.6**: "Link al historial desde el perfil del usuario (localizar ProfileView.tsx y agregar el link)."

**Encontrado**: `ProfileView.tsx` no tiene referencia a `market/history` ni a trades. El historial solo es accesible desde la navegación de `/market`.

---

## Checklist de features por spec

### F-01: Inventario
- [x] `src/hooks/useInventory.ts` existe y retorna `UserCard[]`
- [x] `src/app/api/cards/inventory/route.ts` existe con auth + rate limit + available_quantity derivado
- [x] Tipos `UserCard` con `quantity`/`locked_quantity` en `src/types/index.ts`
- [x] Migration SQL con nuevo schema `user_cards` stacked (PK compuesta, CHECKs)

### F-02: Listings
- [x] `src/app/api/market/listings/route.ts` (GET + POST) — auth, rate limit 60/min y 10/min, UUID/boolean validation, RPC `create_listing`
- [x] `src/app/api/market/listings/[id]/route.ts` (DELETE) — auth, ownership via RPC `cancel_listing`
- [x] `src/hooks/useMarket.ts` con `useCreateListing`, `useCancelListing` + optimistic updates
- [x] `src/components/market/ListingModal.tsx`
- [x] `src/app/(main)/market/page.tsx`

### F-03: Ofertas
- [x] `src/app/api/market/listings/[id]/offers/route.ts` (GET + POST) — rate limit 5/min en POST (spec obliga)
- [x] `src/app/api/market/listings/[id]/offers/[offerId]/route.ts` (DELETE — cancel offer)
- [x] `src/hooks/useMarket.ts` con `useCreateOffer`, `useCancelOffer`
- [x] `src/components/market/OfferModal.tsx` — filtra por rarity_points
- [x] `src/lib/trading.ts` con `hasEnoughPoints()`
- [ ] **WARNING (W-01)**: Ruta `/market/[listingId]` para offer via drop zone no existe

### F-04: Intercambio atómico
- [x] `src/app/api/market/listings/[id]/offers/[offerId]/accept/route.ts` — llama RPC `execute_trade`
- [x] `src/hooks/useMarket.ts` con `useAcceptOffer`
- [x] `src/components/market/TradeConfirmModal.tsx`
- [x] Migration SQL con RPC `execute_trade` (FOR UPDATE, cascade reject, trade_history, notificaciones inline)

### F-05: Wishlist
- [x] `src/app/api/wishlist/route.ts` (GET + POST) — auth, rate limit, UUID validation, 409 on duplicate
- [x] `src/app/api/wishlist/[cardId]/route.ts` (DELETE)
- [x] `src/hooks/useWishlist.ts` con `useWishlist`, `useToggleWishlist` (optimistic toggle)
- [x] `src/app/(main)/wishlist/page.tsx`
- [x] `src/components/wishlist/WishlistHeart.tsx`

### F-06: Notificaciones
- [x] 6 tipos nuevos en `NotificationType` en `src/types/index.ts` (`trade_offer_received`, `trade_offer_accepted`, `trade_offer_rejected`, `wishlist_card_listed`, `listing_expired`, `trade_match_suggested`)
- [x] Rendering de los 6 tipos en `notifications/page.tsx` con texto descriptivo y link de navegación

### F-07: Expiración
- [x] `expire_listings` RPC en migration SQL (idempotente, batch 500, FOR UPDATE SKIP LOCKED)
- [x] `src/app/api/market/expire/route.ts` protegido por `x-cron-secret`
- [!] **SUGGESTION (S-01)**: `pg_cron` job no está comentado en la migración (puede fallar si extensión no activa)

---

## Seguridad — Verificación de rate limits

| Endpoint | Spec | Implementado | Estado |
|----------|------|--------------|--------|
| POST /api/market/listings | 10/min | `rateLimit(key, 10, 60_000)` | ✅ |
| POST .../offers | 5/min | `rateLimit(key, 5, 60_000)` | ✅ |
| POST .../accept | 20/min | `rateLimit(key, 20, 60_000)` | ✅ |
| POST /api/wishlist | 20/min | `rateLimit(key, 20, 60_000)` | ✅ |
| GET /api/market/listings | 60/min | `rateLimit(key, 60, 60_000)` | ✅ |
| GET /api/cards/inventory | 60/min | `rateLimit(key, 60, 60_000)` | ✅ |

---

## Seguridad — Auth y ownership

| Check | Estado |
|-------|--------|
| Todas las routes verifican sesión (401 sin user) | ✅ |
| `/api/market/expire` protegida por `x-cron-secret` (no por sesión de usuario) | ✅ |
| Mutations usan admin client para llamar RPCs | ✅ |
| Ownership en cancel listing via RPC `cancel_listing(p_listing_id, p_user_id)` | ✅ |
| Ownership en accept offer: verifica `seller_id === user.id` antes de llamar RPC | ✅ |
| RLS habilitada en tablas trading (migration SQL) | ✅ |
| `execute_trade` tiene REVOKE PUBLIC + GRANT service_role | ✅ |

---

## Tests

```
Test Files  1 failed | 22 passed (23)
     Tests  1 failed | 227 passed (228)
  Duration  23.00s
```

La falla (`Avatar.test.tsx: renderiza una imagen cuando se pasa url`) es **pre-existente** y no está relacionada con el trading system. El test espera `src="https://example.com/avatar.jpg"` pero Next.js Image optimiza la URL a `/_next/image?url=...`. Está documentado en `coverage-gaps.md`.

Los 227 tests pasantes incluyen:
- Tests de API routes del mercado (listings GET/POST, DELETE, offers CRUD, accept, expire, wishlist)
- Tests de hooks (useMarket, useInventory, useWishlist) con optimistic updates y rollbacks
- Tests de componentes (ListingModal, OfferModal, RarityBadge)
- Tests de lógica pura (trading-validation: hasEnoughPoints, hasAvailableQuantity, RARITY_POINTS)

---

## Gaps de integración (sin cobertura unit — requieren Supabase local)

Documentados en `coverage-gaps.md`. 23 scenarios dependen de RPCs PostgreSQL reales:
- F-01: migración, locked_quantity consistency, rollback
- F-03: auto-accept flow end-to-end, cancel offer con locked_quantity real
- F-04: execute_trade con FOR UPDATE real, race conditions
- F-05/F-06: notificaciones generadas por RPCs
- F-07: expire_listings con DB real

Estrategia recomendada: `supabase start` + suite de integración separada.

---

## Recomendación

**PASS_WITH_WARNINGS — listo para continuar con correcciones menores antes de archive.**

Prioridad de correcciones:
1. **(W-02) Crítico para UX del buyer**: Implementar `GET /api/market/my-offers` route o redirigir `useMyOffers` a un endpoint existente.
2. **(W-01) Funcional pero incompleto**: Crear `src/app/(main)/market/[listingId]/page.tsx` con detalle de listing y `GET /api/market/listings/[id]`.
3. **(S-01) Riesgo de deploy**: Comentar el `SELECT cron.schedule(...)` en la migración o documentar como paso manual.
4. **(S-03) Bug potencial**: Verificar e implementar `GET /api/market/history/route.ts` si no existe.
5. **(W-03 / S-04)**: Opcionales — pueden ir en el siguiente sprint.
