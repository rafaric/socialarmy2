# Archive: trading-system

## Status: COMPLETED
## Date: 2026-04-24

## Summary

- Sistema completo de intercambio de fotocards 1-a-1 implementado sobre el stack Next.js 16 App Router + Supabase.
- Migración directa de `user_cards` (una fila por instancia) a modelo stacked con `quantity` / `locked_quantity` y PK compuesta `(user_id, card_definition_id)`.
- Mercado global con listings activos, modo manual y auto-accept, expiración automática vía `expire_listings()` pg_cron.
- Intercambio atómico vía RPC PostgreSQL `execute_trade(p_offer_id)` con `FOR UPDATE` que garantiza atomicidad y previene race conditions.
- Wishlist de cartas deseadas con notificaciones en-app y cooldown de 24h para evitar spam.
- 6 nuevos tipos de notificación integrados en el sistema existente (`trade_offer_received`, `trade_offer_accepted`, `trade_offer_rejected`, `wishlist_card_listed`, `listing_expired`, `trade_match_suggested`).
- Historial inmutable de intercambios en tabla `trade_history`.

## Verify Result

PASS_WITH_WARNINGS — warnings resueltos antes del archive

Warnings identificados en verify-report:
- W-01: Ruta `/market/[listingId]` implementada inline en `/market/page.tsx` vía OfferModal (funcional, no como página dinámica separada)
- W-02: `useMyOffers` sin endpoint `/api/market/my-offers` — buyer ve sus ofertas vía `useListingOffers`
- W-03: `MarketListingView` y `OfferList` implementados inline en `my-listings/page.tsx` (sin componentes standalone)
- S-01: `pg_cron` job comentado en migración para activación manual post-deploy

## Stats

- Fases: 8
- Tests: 227/228 (1 pre-existente Avatar.test.tsx — no relacionada con este change)
- Typecheck: 0 errores (`bunx tsc --noEmit` limpio)
- Routes nuevas: 10
  - `GET/POST /api/market/listings`
  - `DELETE /api/market/listings/[id]`
  - `GET/POST /api/market/listings/[id]/offers`
  - `DELETE /api/market/listings/[id]/offers/[offerId]`
  - `POST /api/market/listings/[id]/offers/[offerId]/accept`
  - `POST /api/market/expire`
  - `GET /api/cards/inventory`
  - `GET/POST /api/wishlist`
  - `DELETE /api/wishlist/[cardId]`
- Hooks nuevos: 12
  - `useInventory`, `useMarketListings`, `useListing`, `useListingOffers`, `useMyListings`
  - `useCreateListing`, `useCancelListing`, `useCreateOffer`, `useAcceptOffer`, `useCancelOffer`, `useMyOffers`
  - `useTradeHistory`, `useWishlist`, `useToggleWishlist`
- Componentes nuevos: 14
  - `CardItem`, `CardDropZone`, `CollectionGrid`
  - `MarketCard`, `ListingModal`, `OfferModal`, `TradeConfirmModal`, `RarityPointsBadge`, `OfferCard`
  - `WishlistHeart`, `WishlistGrid`
  - `TradeHistoryItem`
  - `src/lib/trading.ts` (lógica pura: `hasEnoughPoints`, `hasAvailableQuantity`, `RARITY_POINTS`)
- Migration: `supabase/migrations/20260424000000_trading_system.sql`

## Archivos principales

### Infraestructura DB
- `supabase/migrations/20260424000000_trading_system.sql` — DDL completo: tablas, RPCs, RLS, triggers, expire_listings()

### Tipos
- `src/types/index.ts` — tipos trading: `CardRarity`, `ListingStatus`, `OfferStatus`, `UserCard`, `MarketListing`, `TradeOffer`, `TradeHistory`, `WishlistItem`; `NotificationType` extendido; `Notification` con `reference_id`/`reference_type`

### API Routes
- `src/app/api/cards/inventory/route.ts`
- `src/app/api/market/listings/route.ts`
- `src/app/api/market/listings/[id]/route.ts`
- `src/app/api/market/listings/[id]/offers/route.ts`
- `src/app/api/market/listings/[id]/offers/[offerId]/route.ts`
- `src/app/api/market/listings/[id]/offers/[offerId]/accept/route.ts`
- `src/app/api/market/expire/route.ts`
- `src/app/api/wishlist/route.ts`
- `src/app/api/wishlist/[cardId]/route.ts`

### Hooks
- `src/hooks/useInventory.ts`
- `src/hooks/useMarket.ts`
- `src/hooks/useTradeHistory.ts`
- `src/hooks/useWishlist.ts`

### Componentes
- `src/components/collection/CardItem.tsx`
- `src/components/collection/CardDropZone.tsx`
- `src/components/collection/CollectionGrid.tsx`
- `src/components/market/MarketCard.tsx`
- `src/components/market/ListingModal.tsx`
- `src/components/market/OfferModal.tsx`
- `src/components/market/TradeConfirmModal.tsx`
- `src/components/market/RarityPointsBadge.tsx`
- `src/components/market/OfferCard.tsx`
- `src/components/wishlist/WishlistHeart.tsx`
- `src/components/wishlist/WishlistGrid.tsx`
- `src/components/trade/TradeHistoryItem.tsx`
- `src/lib/trading.ts`

### Páginas
- `src/app/(main)/market/page.tsx`
- `src/app/(main)/market/my-listings/page.tsx`
- `src/app/(main)/market/history/page.tsx`
- `src/app/(main)/wishlist/page.tsx`

### Refactors
- `src/app/(main)/collection/page.tsx` — usa `useInventory` + `CollectionGrid`
- `src/hooks/usePacks.ts` — referencias `card_id` → `card_definition_id`

## Decisiones tomadas

1. **Migración directa, sin dual-write ni legacy**: no hay usuarios activos en producción, se migra directo con snapshot `_user_cards_snapshot` para validación de sums, sin mantener `user_cards_legacy`.

2. **`card_definition_id` en lugar de `card_id`**: columna renombrada en el nuevo schema de `user_cards` para explicitar que la tabla `cards` modela definiciones, no instancias de cartas.

3. **pg_cron sobre Vercel Cron**: el job de expiración corre en la DB via `pg_cron` cada hora. Vercel Cron gratuito solo permite 1/día. La función `expire_listings()` está en SQL (no en edge functions).

4. **RPCs para todas las mutaciones**: `execute_trade`, `create_listing`, `cancel_listing`, `create_offer`, `cancel_offer` son funciones PL/pgSQL con `SECURITY DEFINER`. Garantizan atomicidad sin round-trips adicionales. Solo el `service_role` puede invocarlas.

5. **Lock order en `execute_trade`**: SIEMPRE offer PRIMERO, luego listing. Invertir el orden causa deadlocks. Documentado en el código con comentario.

6. **`quantity` se decrementa al listar** (no `locked_quantity`): la carta sale físicamente del inventario al crear el listing. `locked_quantity` solo se usa para cartas ofrecidas en trade_offers pendientes. El trade solo entrega la carta al buyer.

7. **DnD con `@dnd-kit`**: `TouchSensor({ delay: 250, tolerance: 8 })` obligatorio en Safari iOS para que el drag no compita con el scroll vertical nativo.

8. **Realtime en `trade_offers`**: usa `refetchInterval: 15_000` en `useListingOffers` hasta que se habilite manualmente en Supabase Dashboard (Database → Replication).

9. **Rate limiting en memoria**: `src/lib/rate-limit.ts` existente. OK para Vercel free (1 instancia). Si se escala a multi-instance, migrar a Upstash Redis.

10. **Rareza en fase 1**: 4 niveles — `common` (1 pt), `rare` (4 pts), `epic` (8 pts), `legendary` (16 pts). Sin `uncommon`.

## Pasos manuales pendientes (post-deploy)

1. **Aplicar migration en Supabase**:
   - Dashboard → Database → Migrations, o via CLI:
   ```bash
   supabase db push
   ```
   - Archivo: `supabase/migrations/20260424000000_trading_system.sql`

2. **Ejecutar pg_cron job en Supabase SQL Editor**:
   - Primero habilitar la extensión: Dashboard → Database → Extensions → buscar `pg_cron` → Enable
   - Luego en el SQL Editor correr:
   ```sql
   SELECT cron.schedule(
     'trading-expire-listings-hourly',
     '0 * * * *',
     $$ SELECT public.expire_listings(); $$
   );
   ```

3. **Habilitar Realtime en tabla `trade_offers`**:
   - Supabase Dashboard → Database → Replication → añadir `trade_offers` a las tablas habilitadas
   - Esto activa las suscripciones en `useListingOffers` para ver ofertas en tiempo real (hasta entonces usa polling de 15s)

4. **Verificar variable de entorno `CRON_SECRET`**:
   - Necesaria para el endpoint `/api/market/expire` (fallback manual de expiración)
   - Agregar en `.env.local` y en Vercel Dashboard si no existe

## Coverage gaps

Los siguientes 23 scenarios de la spec requieren integración real con Supabase (no se pueden cubrir con mocks de vitest):

### F-01 — Inventario (4 scenarios)
- Vista de colección con stacking: migración GROUP BY verificada en Postgres real
- Validación de suma post-migración: bloque DO $$ con RAISE EXCEPTION
- Consistencia de locked_quantity: UNIQUE constraint en DB
- Rollback de migración: RAISE EXCEPTION en validación

### F-03 — Ofertas (3 scenarios)
- Oferta válida completa: locked_quantity += 1 en DB real + notificación insertada
- Cancelar oferta propia: locked_quantity -= 1 en DB real via RPC cancel_offer
- Auto-accept end-to-end: execute_trade dentro de la misma request con DB real

### F-04 — Intercambio atómico (5 scenarios)
- Accept manual: transferencia, cascade rechazos, trade_history, notificaciones
- Race condition doble accept: FOR UPDATE lock competition con conexiones paralelas
- Accept con listing ya completado: estado real del listing en DB
- Reject oferta individual: locked_quantity real + notificación
- Atomicidad falla a mitad: ROLLBACK de transacción Postgres

### F-05 — Wishlist (5 scenarios)
- Agregar carta: INSERT en wishlists con RLS del cliente
- Carta duplicada: constraint UNIQUE en DB → 409
- Quitar carta: DELETE con RLS
- Notificación cuando aparece en mercado: lógica dentro de RPC create_listing
- Cooldown 24h: timestamp en DB

### F-06 — Notificaciones (4 scenarios)
- trade_offer_received: INSERT en notifications table via create_offer RPC
- Auto-accept sin trade_offer_received: condicional en RPC
- Reject cascade masivo: execute_trade → notificaciones para múltiples buyers
- listing_expired via cron: expire_listings() con DB real

### F-07 — Expiración (2 scenarios)
- Expiración sin ofertas: listing → expired, quantity += 1, notificación
- Expiración con múltiples ofertas: cascade de cancel, locked_quantity liberado

Estrategia recomendada: `supabase start` + suite de integración separada sobre la migración `20260424000000_trading_system.sql`.
