# Tasks — Trading System

**Change name**: `trading-system`
**Status**: tasks
**Fecha**: 2026-04-23
**Total tareas**: 52
**Modo**: Strict TDD — tests ANTES de implementación en cada módulo

---

## Convenciones de este documento

- `[ ]` = pendiente, `[x]` = completado
- Cada tarea es completable en una sola sesión de trabajo
- El orden dentro de cada fase respeta dependencias
- `bunx tsc --noEmit` debe pasar al finalizar cada fase
- Tests verdes son requisito de salida de cada fase

---

## Fase 1 — Infraestructura DB

**Objetivo**: SQL completo ejecutable, tipos TypeScript actualizados, `tsc` limpio.
**Dependencias externas**: ninguna (primera fase).

---

- [ ] 1.1 Crear archivo de migración SQL base
  - Archivo: `supabase/migrations/20260424_trading_system.sql`
  - Crear el archivo vacío con header de comentario y bloque `BEGIN;` / `COMMIT;`. Será el target de las tareas 1.2–1.8.
  - Nota: toda la migración corre como una transacción única. Si algún paso falla, Postgres hace rollback completo.

- [ ] 1.2 DDL — `rarity_points` en tabla `cards`
  - Archivo: `supabase/migrations/20260424_trading_system.sql`
  - Agregar columna `rarity_points smallint NOT NULL` a `public.cards` con `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`.
  - `UPDATE` para poblar valores existentes según el `CASE rarity`.
  - Trigger `trg_sync_card_rarity_points` para mantener el valor sincronizado en inserts/updates futuros.
  - Ver §1.1 del design para el SQL completo.

- [ ] 1.3 DDL — Migración directa de `user_cards`
  - Archivo: `supabase/migrations/20260424_trading_system.sql`
  - Snapshot `_user_cards_snapshot` → `DROP TABLE user_cards CASCADE` → recrear con nuevo schema `(user_id, card_definition_id, quantity, locked_quantity, first_obtained_at, updated_at)` + PK compuesta + CHECKs de invariante.
  - Restaurar datos desde snapshot. Validación dura con bloque `DO $$ ... RAISE EXCEPTION $$` que hace rollback si los sums difieren.
  - Trigger `trg_touch_user_cards_updated_at`.
  - Índices: `idx_user_cards_user`, `idx_user_cards_card`, `idx_user_cards_user_available` (parcial `WHERE quantity > locked_quantity`).
  - Ver §1.2 del design para el SQL completo.
  - **Gotcha**: `card_id` se renombra a `card_definition_id` — cualquier código que use el nombre viejo romperá. Verificar en `usePacks.ts` y `collection/page.tsx`.

- [ ] 1.4 DDL — Tablas nuevas: `market_listings`, `trade_offers`, `trade_history`, `wishlists`
  - Archivo: `supabase/migrations/20260424_trading_system.sql`
  - `market_listings`: CHECK de status, UNIQUE parcial `uniq_active_listing_per_seller_card`, índices de status/seller/card.
  - `trade_offers`: CHECK de status, UNIQUE parcial `uniq_pending_offer_per_buyer_card_listing`, índices de listing/buyer.
  - `trade_history`: índices por seller y buyer.
  - `wishlists`: PK compuesta, índice por `card_definition_id`.
  - Ver §§1.3–1.6 del design.

- [ ] 1.5 DDL — RLS en todas las tablas nuevas + `user_cards`
  - Archivo: `supabase/migrations/20260424_trading_system.sql`
  - `user_cards`: `ENABLE ROW LEVEL SECURITY` + policy SELECT (`auth.uid() = user_id`).
  - `market_listings`: SELECT para listings activos o propios.
  - `trade_offers`: SELECT para seller del listing y buyer propio.
  - `trade_history`: SELECT para las dos partes del trade.
  - `wishlists`: SELECT + INSERT + DELETE propios.
  - **Nota**: NO agregar policies de INSERT/UPDATE/DELETE en `user_cards`, `market_listings`, `trade_offers`, `trade_history` — las escrituras van exclusivamente por API routes con admin client.
  - Ver §1.7 del design.

- [ ] 1.6 DDL — Extensión de `notifications` con `reference_id` y `reference_type`
  - Archivo: `supabase/migrations/20260424_trading_system.sql`
  - `ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS reference_id uuid` + `reference_type text`.
  - Agregar `COMMENT ON COLUMN` para documentar el uso.
  - Ver §1.10 del design.

- [ ] 1.7 RPCs SQL — `execute_trade`, `create_listing`, `cancel_listing`, `create_offer`, `cancel_offer`
  - Archivo: `supabase/migrations/20260424_trading_system.sql`
  - `execute_trade(p_offer_id uuid) RETURNS jsonb`: lógica completa con FOR UPDATE en offer y listing, transferencia de cartas, cascade de rechazos, notificaciones inline, insert en trade_history, REVOKE/GRANT de permisos. Ver §7 del design para SQL completo.
  - `create_listing(p_seller_id, p_card_id, p_auto_accept) RETURNS jsonb`: FOR UPDATE en user_cards, decrementa quantity, inserta listing, notifica wishlist con cooldown 24h (ver §8). REVOKE/GRANT.
  - `cancel_listing(p_listing_id, p_user_id) RETURNS jsonb`: valida ownership + status, cancela ofertas pending, libera locked_quantity, devuelve carta al seller, notifica buyers rechazados. REVOKE/GRANT.
  - `create_offer(p_listing_id, p_buyer_id, p_offered_card_id) RETURNS jsonb`: valida puntos, disponibilidad, duplicados; lockea carta; inserta oferta; notifica seller (solo si !auto_accept); si auto_accept llama `execute_trade` en cascada. REVOKE/GRANT.
  - `cancel_offer(p_offer_id, p_user_id) RETURNS jsonb`: valida ownership + status pending, libera locked_quantity, marca cancelled. REVOKE/GRANT.
  - Ver §§7.1–7.2 del design.
  - **Gotcha**: el orden de lock en `execute_trade` es SIEMPRE offer PRIMERO, luego listing. Invertirlo causa deadlocks.

- [ ] 1.8 RPC SQL — `expire_listings()` + comentario pg_cron
  - Archivo: `supabase/migrations/20260424_trading_system.sql`
  - Función `expire_listings() RETURNS TABLE(processed integer, errors integer)`: SECURITY DEFINER, loop con `FOR UPDATE SKIP LOCKED`, libera locks, devuelve carta al seller, inserta notif `listing_expired`, manejo de errores por fila sin abortar el batch. LIMIT 500 por tick.
  - Bloque pg_cron comentado al final: `-- HABILITAR CUANDO pg_cron esté activo en el proyecto Supabase:` seguido del `SELECT cron.schedule(...)` comentado. El operador lo descomenta manualmente.
  - Ver §1.9 del design.

- [ ] 1.9 Tipos TypeScript — bloque Trading System en `src/types/index.ts`
  - Archivo: `src/types/index.ts`
  - Agregar al final: `CardRarity`, `ListingStatus`, `OfferStatus`, tipos `Card`, `UserCard`, `MarketListing`, `TradeOffer`, `TradeHistory`, `WishlistItem`, `CreateListingPayload`, `CreateOfferPayload`, `ListingsQuery`, `TradeApiError`.
  - Reemplazar la línea de `NotificationType` existente por la versión extendida con los 6 tipos trading.
  - Extender `Notification` con `reference_id?` y `reference_type?`.
  - Ver §2 del design para el bloque TypeScript completo.
  - Correr `bunx tsc --noEmit` al finalizar — debe pasar limpio.

---

## Fase 2 — API Routes

**Objetivo**: 10 routes implementadas con tests. Cada route sigue el patrón de `src/app/api/friends/request/route.ts`.
**Dependencias**: Fase 1 completada (tipos TypeScript disponibles).
**Nota TDD**: escribir el archivo de test ANTES del handler en cada tarea.

---

- [ ] 2.1 Test + route `GET /api/cards/inventory`
  - Archivos: `src/app/api/cards/inventory/__tests__/route.test.ts` → `src/app/api/cards/inventory/route.ts`
  - Tests primero: 401 sin sesión, 429 sobre rate limit (60/min), 200 con lista de `UserCard[]` + campo derivado `available_quantity = quantity - locked_quantity`.
  - Handler: sesión, rate limit 60/min, query a `user_cards` JOIN `cards` WHERE `user_id=user.id` ORDER BY `rarity_points DESC, name ASC`, mapeo del campo derivado.

- [ ] 2.2 Test + route `GET /api/market/listings`
  - Archivos: `src/app/api/market/listings/__tests__/route.test.ts` → `src/app/api/market/listings/route.ts`
  - Tests: 401, 429, 400 por `limit` fuera de rango o `rarity` inválido, 400 por `cursor` no ISO, 200 con paginación cursor-based y `next_cursor: null` en última página.
  - Handler: rate limit 60/min, validar query params (`limit` 1–50, `rarity` en enum, `cursor` ISO), query `market_listings` JOIN `cards` JOIN `profiles` WHERE `status='active' AND expires_at > now()` ORDER `created_at DESC` con cursor.

- [ ] 2.3 Test + route `POST /api/market/listings`
  - Archivos: `src/app/api/market/listings/__tests__/route.test.ts` (agregar casos)
  - Tests: 401, 429 (10/min), 400 UUID inválido, 400 `auto_accept` no boolean, 422 `available_quantity_insufficient`, 422 `duplicate_active_listing`, 201 con `{ listing: MarketListing }`.
  - Handler: rate limit 10/min, validar UUID + boolean, llamar RPC `create_listing(user.id, card_definition_id, auto_accept)`, mapear jsonb retornado a HTTP status.
  - Mismo archivo que 2.2 (mismo route.ts con `export async function POST`).

- [ ] 2.4 Test + route `DELETE /api/market/listings/[id]`
  - Archivos: `src/app/api/market/listings/[id]/__tests__/route.test.ts` → `src/app/api/market/listings/[id]/route.ts`
  - Tests: 401, 429 (20/min), 400 UUID inválido, 403 ownership falla, 409 `listing_not_cancellable`, 200 `{ ok: true }`.
  - Handler: rate limit 20/min, validar UUID, verificar ownership (buscar listing con seller_id = user.id), llamar RPC `cancel_listing(id, user.id)`.

- [ ] 2.5 Test + route `GET /api/market/listings/[id]/offers`
  - Archivos: `src/app/api/market/listings/[id]/offers/__tests__/route.test.ts` → `src/app/api/market/listings/[id]/offers/route.ts`
  - Tests: 401, 403 (no es el seller), 200 con `TradeOffer[]` + joins.
  - Handler: rate limit 60/min, verificar que user.id = listing.seller_id, query `trade_offers` WHERE `listing_id AND status='pending'` JOIN `offered_card` + `buyer`.

- [ ] 2.6 Test + route `POST /api/market/listings/[id]/offers`
  - Archivos: `src/app/api/market/listings/[id]/offers/__tests__/route.test.ts` (agregar casos)
  - Tests: 401, 429 (5/min — crítico spec F-03), 422 `no_self_offer`, 422 `listing_not_active`, 422 `listing_expired`, 422 `insufficient_points`, 422 `available_quantity_insufficient`, 422 `duplicate_pending_offer`, 201 pending, 201 accepted (auto_accept).
  - Handler: rate limit **5/min/user**, llamar RPC `create_offer(listing_id, user.id, offered_card_id)`, si retorna `ok: false` mapear a 422 con error code.
  - Mismo archivo route.ts que 2.5 (agregar `export async function POST`).

- [ ] 2.7 Test + route `POST /api/market/listings/[id]/offers/[offerId]/accept`
  - Archivos: `src/app/api/market/listings/[id]/offers/[offerId]/accept/__tests__/route.test.ts` → `src/app/api/market/listings/[id]/offers/[offerId]/accept/route.ts`
  - Tests: 401, 429 (20/min), 403 no es el seller, 422 `listing_not_active` / `offer_invalid` / `insufficient_points`, 200 `{ ok: true, trade_id: string }`.
  - Handler: rate limit 20/min, verificar ownership del listing, llamar RPC `execute_trade(offerId)`, mapear jsonb.

- [ ] 2.8 Test + route `DELETE /api/market/listings/[id]/offers/[offerId]`
  - Archivos: `src/app/api/market/listings/[id]/offers/[offerId]/__tests__/route.test.ts` → `src/app/api/market/listings/[id]/offers/[offerId]/route.ts`
  - Tests: 401, 409 `offer_not_cancellable`, 200 `{ ok: true }`.
  - Handler: rate limit 20/min, verificar que buyer_id = user.id, llamar RPC `cancel_offer(offerId, user.id)`.

- [ ] 2.9 Test + routes `GET/POST /api/wishlist` y `DELETE /api/wishlist/[cardId]`
  - Archivos: `src/app/api/wishlist/__tests__/route.test.ts` → `src/app/api/wishlist/route.ts` + `src/app/api/wishlist/[cardId]/route.ts`
  - Tests GET: 401, 200 con `WishlistItem[]`.
  - Tests POST: 401, 429 (20/min), 400 UUID inválido, 409 `already_in_wishlist`, 201 `{ item }`.
  - Tests DELETE: 401, 200 `{ ok: true }`.
  - Handler POST usa admin client para INSERT en `wishlists`. DELETE verifica ownership.

- [ ] 2.10 Test + route `POST /api/market/expire`
  - Archivos: `src/app/api/market/expire/__tests__/route.test.ts` → `src/app/api/market/expire/route.ts`
  - Tests: 401 sin header `x-cron-secret`, 401 con secret inválido, 200 `{ processed: N, errors: N }`.
  - Handler: verificar `req.headers.get("x-cron-secret") === process.env.CRON_SECRET`, llamar `SELECT * FROM public.expire_listings()` vía admin client, retornar resultado.

---

## Fase 3 — Hooks React Query

**Objetivo**: 12 hooks con tests. Todos en `src/hooks/`.
**Dependencias**: Fase 2 completada (API routes disponibles para mockear).
**Nota TDD**: test file ANTES del hook.

---

- [ ] 3.1 Test + hook `useInventory`
  - Archivos: `src/hooks/__tests__/useInventory.test.ts` → `src/hooks/useInventory.ts`
  - Tests: queryKey `["inventory", userId]`, fetching de `/api/cards/inventory`, tipado de `UserCard[]`, campo `available_quantity` presente.
  - Hook: `useQuery` con `queryFn` fetch a `/api/cards/inventory`.

- [ ] 3.2 Test + hooks de lectura de mercado: `useMarketListings`, `useListing`, `useListingOffers`, `useMyListings`
  - Archivos: `src/hooks/__tests__/useMarket.test.ts` → `src/hooks/useMarket.ts`
  - `useMarketListings(filters?)`: `useInfiniteQuery` con cursor-based pagination, queryKey `["market", "listings", filters]`.
  - `useListing(id)`: queryKey `["market", "listing", id]`.
  - `useListingOffers(listingId)`: queryKey `["market", "listing", listingId, "offers"]`, `refetchInterval: 15_000` (Realtime se activa en Fase 5).
  - `useMyListings()`: queryKey `["market", "my-listings", userId]`.

- [ ] 3.3 Test + mutation `useCreateListing`
  - Archivo: `src/hooks/__tests__/useMarket.test.ts` (agregar), `src/hooks/useMarket.ts`
  - Tests: POST a `/api/market/listings`, optimistic update en `["inventory"]` decrementando `quantity` y `available_quantity`, rollback en error, invalidaciones post-success: `["inventory"]`, `["market", "listings"]`, `["market", "my-listings"]`.

- [ ] 3.4 Test + mutation `useCancelListing`
  - Archivo: `src/hooks/__tests__/useMarket.test.ts` (agregar), `src/hooks/useMarket.ts`
  - Tests: DELETE a `/api/market/listings/[id]`, invalidaciones: `["inventory"]`, `["market", "my-listings"]`, `["market", "listing", id]`.

- [ ] 3.5 Test + mutations `useCreateOffer`, `useAcceptOffer`, `useCancelOffer` + query `useMyOffers`
  - Archivo: `src/hooks/__tests__/useMarket.test.ts` (agregar), `src/hooks/useMarket.ts`
  - `useCreateOffer`: optimistic update incrementando `locked_quantity` en inventory, rollback en error. Si auto_accept en response → también invalida `["market", "listings"]` y `["trade-history"]`.
  - `useAcceptOffer`: invalida `["inventory"]`, `["market", "listing", id]`, `["market", "my-listings"]`, `["trade-history"]`.
  - `useCancelOffer`: invalida `["inventory"]`, `["market", "listing", listingId, "offers"]`, `["my-offers"]`.
  - `useMyOffers(status?)`: queryKey `["my-offers", userId, status]`.

- [ ] 3.6 Test + hooks `useTradeHistory`, `useWishlist`, `useToggleWishlist`
  - Archivos: `src/hooks/__tests__/useTradeHistory.test.ts` → `src/hooks/useTradeHistory.ts` | `src/hooks/__tests__/useWishlist.test.ts` → `src/hooks/useWishlist.ts`
  - `useTradeHistory`: queryKey `["trade-history", userId]`.
  - `useWishlist`: queryKey `["wishlist", userId]`.
  - `useToggleWishlist`: optimistic toggle (add/remove item localmente antes de que la mutación resuelva), rollback en error, invalida `["wishlist", userId]`.

---

## Fase 4 — UI: Colección

**Objetivo**: la página `/collection` usa el nuevo schema stacked. DnD funcional.
**Dependencias**: Fase 3 (`useInventory` disponible).

---

- [ ] 4.1 Instalar `@dnd-kit`
  - Archivo: `package.json`
  - Comando: `bun add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`
  - Correr `bunx tsc --noEmit` post-instalación para verificar tipos.

- [ ] 4.2 Componente `CardItem`
  - Archivo: `src/components/collection/CardItem.tsx`
  - Presentacional: imagen, badge rareza, badge `×N` (cantidad), badge `🔒 N` si `locked_quantity > 0`, prop `isDragging` para feedback visual (opacidad / scale).
  - Acepta `userCard: UserCard`, `isDragging?: boolean`, `onClick?: () => void`.
  - Botón fallback "Listar" visible siempre (accesibilidad + mobile backup).

- [ ] 4.3 Componente `CardDropZone`
  - Archivo: `src/components/collection/CardDropZone.tsx`
  - Wrapper sobre `useDroppable` de `@dnd-kit/core`. Props: `id: string`, `data?: Record<string, unknown>`, `children: React.ReactNode`, `className?: string`.
  - Visual feedback cuando está activo (`isOver`): borde punteado + highlight.

- [ ] 4.4 Componente `CollectionGrid` con DnD
  - Archivo: `src/components/collection/CollectionGrid.tsx`
  - `<DndContext sensors={[PointerSensor, TouchSensor(250ms), KeyboardSensor]}`.
  - Loop de `CardItem` con `useDraggable` (id = `card_definition_id`).
  - Slots para `CardDropZone` (props `marketDropZone?: boolean`, `wishlistDropZone?: boolean`).
  - Handler `onDragEnd` con validación de `available_quantity >= 1`, dispatch de modales según `over.id` (ver §6.4 del design).
  - **Gotcha iOS Safari**: `TouchSensor({ delay: 250, tolerance: 8 })` es obligatorio o el drag compite con el scroll vertical.

- [ ] 4.5 Refactor `src/app/(main)/collection/page.tsx`
  - Archivo: `src/app/(main)/collection/page.tsx`
  - Reemplazar uso de `useCollection` / `usePacks` con `useInventory`.
  - Reemplazar referencia a `card_id` por `card_definition_id`.
  - Usar `CollectionGrid` con `marketDropZone={true}`.
  - Integrar `ListingModal` (tarea 5.2) — puede importarlo aunque aún no esté implementado usando un placeholder de `null`.
  - Nota: `usePacks.ts` puede tener referencias al schema viejo — revisar y ajustar o crear bridge interno.

---

## Fase 5 — UI: Mercado

**Objetivo**: páginas `/market` y `/market/[listingId]` funcionales con DnD.
**Dependencias**: Fase 4 (componentes colección, DnD setup), Fase 3 (hooks de mercado).

---

- [ ] 5.1 Componente `RarityPointsBadge`
  - Archivo: `src/components/market/RarityPointsBadge.tsx`
  - Presentacional: recibe `rarity: CardRarity` + `points: number`. Muestra badge con color por rareza y texto ("4 pts", "★ legendary 16 pts").

- [ ] 5.2 Componente `ListingModal`
  - Archivo: `src/components/market/ListingModal.tsx`
  - Se abre cuando el usuario dropea o hace click en "Listar".
  - Props: `card: UserCard`, `open: boolean`, `onClose: () => void`.
  - Contenido: preview de la carta, toggle `auto_accept` (con tooltip explicativo), botón "Confirmar".
  - Pre-validación cliente: `available_quantity >= 1` (mostrar error si no).
  - Llama `useCreateListing` al confirmar. Cierra + toast en success.

- [ ] 5.3 Componente `OfferModal`
  - Archivo: `src/components/market/OfferModal.tsx`
  - Se abre al drop en `offer-drop` o al click en "Ofertar".
  - Props: `listingId: string`, `minPoints: number`, `preselectedCard?: UserCard`, `open: boolean`, `onClose: () => void`.
  - Lista el inventario del user filtrado por `rarity_points >= minPoints` y `available_quantity >= 1`.
  - Si hay `preselectedCard`, pre-seleccionarla.
  - Llama `useCreateOffer` al confirmar. Cierra + toast.

- [ ] 5.4 Componente `TradeConfirmModal`
  - Archivo: `src/components/market/TradeConfirmModal.tsx`
  - Se abre antes de ejecutar `accept` (desde seller en my-listings).
  - Muestra: "Vas a dar [carta listada] y recibir [carta ofrecida]" con imágenes.
  - Props: `offer: TradeOffer`, `listing: MarketListing`, `open: boolean`, `onClose: () => void`.
  - Llama `useAcceptOffer` al confirmar.

- [ ] 5.5 Componente `MarketCard`
  - Archivo: `src/components/market/MarketCard.tsx`
  - Tarjeta presentacional en el grid del mercado.
  - Muestra: imagen de carta, nombre, rareza, seller (avatar + username), tiempo restante (`expires_at`), badge "auto-accept" si aplica, `RarityPointsBadge`.
  - Link a `/market/[listingId]`.
  - Incluye `WishlistHeart` (tarea 7.1) — importar con dynamic o placeholder.

- [ ] 5.6 Página `/market` — listado global
  - Archivo: `src/app/(main)/market/page.tsx`
  - Usa `useMarketListings(filters)` con infinite scroll (Intersection Observer).
  - Filtro por rareza (pills: all / common / rare / epic / legendary).
  - Grid de `MarketCard`.
  - `CardDropZone id="market-drop"` para listar desde aquí (alternativa a `/collection`).
  - Habilitar Realtime en `trade_offers` requiere config en Supabase dashboard — dejar comentario `// TODO: Fase 5 — habilitar Realtime en trade_offers en Supabase dashboard`.

- [ ] 5.7 Página `/market/[listingId]` — detalle + ofertar
  - Archivo: `src/app/(main)/market/[listingId]/page.tsx`
  - Usa `useListing(id)` para datos del listing.
  - Muestra datos del seller, carta listada, puntos requeridos, tiempo restante, auto-accept badge.
  - `CardDropZone id="offer-drop" data={{ listingId, minPoints }}` para drop desde colección.
  - Botón "Ofertar" abre `OfferModal`.
  - Si el user es el seller: link a "Mis listings".

---

## Fase 6 — UI: Mis listings

**Objetivo**: seller puede ver sus listings activos, ver ofertas recibidas y aceptar/rechazar.
**Dependencias**: Fase 5 (modales disponibles).

---

- [ ] 6.1 Componente `OfferCard`
  - Archivo: `src/components/market/OfferCard.tsx`
  - Presentacional para el seller. Muestra: carta ofrecida (imagen + rareza + puntos), avatar + username del buyer, fecha de la oferta.
  - Botones "Aceptar" (abre `TradeConfirmModal`) y "Rechazar" (llama `useCancelOffer` en nombre del seller — en realidad el seller no cancela la oferta, sino que la ignora o espira; si se implementa reject manual agregar ruta específica).
  - **Gotcha**: el seller no tiene un endpoint de "reject" explícito — solo puede `accept` (que rechaza las demás) o `cancel_listing` (que rechaza todas). Documentar esto en el componente con un comentario.

- [ ] 6.2 Componente `OfferList`
  - Archivo: `src/components/market/OfferList.tsx`
  - Lista de `OfferCard` con estado vacío ("No hay ofertas todavía").
  - Usa `useListingOffers(listingId)`.

- [ ] 6.3 Componente `MarketListingView`
  - Archivo: `src/components/market/MarketListingView.tsx`
  - Vista completa de un listing para el seller: datos de la carta, status, contador de ofertas, botón "Cancelar listing" (con confirmación), `OfferList`.

- [ ] 6.4 Página `/market/my-listings`
  - Archivo: `src/app/(main)/market/my-listings/page.tsx`
  - Usa `useMyListings()`.
  - Lista de `MarketListingView` para cada listing activo del seller.
  - `CardDropZone id="market-drop"` para crear nuevos listings por drag.
  - Estado vacío con CTA "Ver tu colección".

---

## Fase 7 — Wishlist + Notificaciones + Historial

**Objetivo**: wishlist completa, 6 tipos de notificación funcionales, historial de trades en perfil.
**Dependencias**: Fase 6 completada.

---

- [ ] 7.1 Componente `WishlistHeart`
  - Archivo: `src/components/wishlist/WishlistHeart.tsx`
  - Toggle corazón. Props: `cardDefinitionId: string`, `className?: string`.
  - Usa `useWishlist()` para saber si está en wishlist + `useToggleWishlist()`.
  - Optimistic: toggle visual inmediato, rollback en error.

- [ ] 7.2 Componente `WishlistGrid`
  - Archivo: `src/components/wishlist/WishlistGrid.tsx`
  - Grid de cartas de la wishlist. Usa `useWishlist()`.
  - Cada item muestra la carta (imagen, rareza, nombre) + `WishlistHeart` para quitar.
  - `CardDropZone id="wishlist-drop"` para agregar por drag.

- [ ] 7.3 Página `/wishlist`
  - Archivo: `src/app/(main)/wishlist/page.tsx`
  - Usa `WishlistGrid`.
  - Estado vacío con CTA "Explorá el mercado".

- [ ] 7.4 Integrar `WishlistHeart` en `MarketCard` y en detalle de listing
  - Archivos: `src/components/market/MarketCard.tsx`, `src/app/(main)/market/[listingId]/page.tsx`
  - Importar y ubicar `WishlistHeart` con `cardDefinitionId={listing.card_definition_id}`.

- [ ] 7.5 Extender sistema de notificaciones para 6 tipos trading
  - Archivos: componentes de notificación existentes en `src/components/` o `src/app/(main)/notifications/`
  - Localizar el componente que renderiza `NotificationItem` (revisar `src/app/(main)/notifications/` y `src/components/`).
  - Agregar casos para los 6 nuevos tipos: `trade_offer_received`, `trade_offer_accepted`, `trade_offer_rejected`, `wishlist_card_listed`, `listing_expired`, `trade_match_suggested`.
  - Cada tipo tiene texto descriptivo y, si tiene `reference_id` + `reference_type`, link de navegación (`/market/[listing_id]` o a la oferta).

- [ ] 7.6 Componente `TradeHistoryItem` + página `/market/history`
  - Archivos: `src/components/trade/TradeHistoryItem.tsx`, `src/app/(main)/market/history/page.tsx`
  - `TradeHistoryItem`: fila del historial. Muestra "Diste [carta ofrecida] / Recibiste [carta listada]" o "Vendiste [carta listada] / Obtuviste [carta ofrecida]" según si el user fue seller o buyer. Fecha del trade.
  - Página: usa `useTradeHistory()`, lista de `TradeHistoryItem`, estado vacío.
  - Link al historial desde el perfil del usuario (localizar `ProfileView.tsx` en `src/components/` y agregar el link).

---

## Fase 8 — Testing + QA

**Objetivo**: cobertura completa, `bun run test:run` verde, QA manual en mobile.
**Dependencias**: Fases 1–7 completadas.
**Nota**: en Strict TDD, la mayoría de tests ya existen de fases anteriores. Esta fase cierra gaps y añade tests de integración.

---

- [ ] 8.1 Tests unitarios de lógica de puntos (validaciones en RPCs)
  - Archivo: `src/app/api/market/listings/[id]/offers/__tests__/route.test.ts` (agregar edge cases)
  - Casos: `common (1 pt) oferta por epic (8 pts)` → debe pasar. `epic (8 pts) oferta por common (1 pt)` → 422 `insufficient_points`. Exactamente iguales → debe pasar.
  - Nota: los tests de la RPC SQL en sí requieren un entorno Postgres real (pg-mem o Supabase local). Estos tests cubren la validación que hace la API route antes de llamar la RPC.

- [ ] 8.2 Tests de `lock/unlock` — ciclo de vida de `locked_quantity`
  - Archivo: `src/hooks/__tests__/useMarket.test.ts` (agregar)
  - Verificar que `useCreateOffer` incrementa `locked_quantity` en el optimistic update.
  - Verificar que `useCancelOffer` decrementa `locked_quantity` post-success.
  - Verificar que `useAcceptOffer` refleja la transferencia en inventory (quantity -= 1 para la carta ofrecida).

- [ ] 8.3 Tests de idempotencia de `expire_listings`
  - Archivo: `src/app/api/market/expire/__tests__/route.test.ts` (agregar)
  - Llamar dos veces al endpoint de expire con el mismo listing ya expirado → segunda llamada debe retornar `{ processed: 0, errors: 0 }`.

- [ ] 8.4 Tests de componentes clave
  - Archivos: `src/components/market/__tests__/ListingModal.test.tsx`, `src/components/market/__tests__/OfferModal.test.tsx`
  - `ListingModal`: se abre con datos correctos, toggle de `auto_accept` funciona, botón deshabilitado si `available_quantity < 1`.
  - `OfferModal`: filtra cartas por `rarity_points >= minPoints`, selección de carta pre-cargada si hay `preselectedCard`.

- [ ] 8.5 QA manual — DnD en mobile
  - No tiene archivo de código asociado (verificación manual).
  - Pasos: (1) abrir en Safari iOS (device real o simulador), (2) verificar que el scroll vertical funciona sin activar drag accidentalmente, (3) verificar que hold de 250ms activa el drag correctamente, (4) verificar que drop en zona abre el modal correcto, (5) probar con carta con `available_quantity = 0` → debe mostrar toast de error sin abrir modal.
  - Documentar resultado en este archivo marcando con `[x]` y anotando el dispositivo/versión.

- [ ] 8.6 Verificación final de tipos y lint
  - Correr `bunx tsc --noEmit` → debe pasar limpio.
  - Correr `bun run test:run` → todos los tests verdes.
  - Revisar que no haya referencias a `card_id` (columna vieja) en el codebase: `rg "card_id" src/ --type ts` — reemplazar por `card_definition_id` donde corresponda.
  - Revisar que `usePacks.ts` y sus consumidores compilen correctamente con el nuevo schema.

---

## Advertencias críticas

### Dependencias entre fases (no saltear)

| Fase | Requiere completar |
|------|--------------------|
| Fase 2 | Fase 1 (tipos TypeScript disponibles para importar en routes) |
| Fase 3 | Fase 2 (routes disponibles para mockear en tests de hooks) |
| Fase 4 | Fase 3 (`useInventory` disponible) |
| Fase 5 | Fase 4 (DnD setup, `useMarket*` disponibles) |
| Fase 6 | Fase 5 (modales disponibles) |
| Fase 7 | Fase 6 completada |
| Fase 8 | Fases 1–7 completadas |

### Gotchas de implementación

1. **`card_id` → `card_definition_id`**: renombre en toda la DB. `usePacks.ts` y `collection/page.tsx` usan el nombre viejo — deben actualizarse en Fase 4.
2. **Lock order en `execute_trade`**: SIEMPRE offer PRIMERO, luego listing. Invertirlo causa deadlocks.
3. **`quantity` se decrementa al listar** (no solo `locked_quantity`): la carta sale físicamente del inventario al crear el listing. El trade solo la entrega al buyer — no hay un segundo decremento.
4. **RLS en `wishlists` sí tiene INSERT/DELETE**: es la única tabla donde el cliente puede escribir directamente (Supabase client-side). El resto de escrituras van por admin client.
5. **pg_cron**: el job está comentado en la migración. Debe descomentarse y correrse manualmente EN EL DASHBOARD DE SUPABASE (Database → Extensions → habilitar `pg_cron`, luego correr el `SELECT cron.schedule(...)` en el SQL Editor).
6. **Realtime en `trade_offers`**: se habilita en Supabase Dashboard (Database → Replication → añadir `trade_offers`). Hasta entonces, `useListingOffers` usa `refetchInterval: 15_000`.
7. **Rate limit in-memory**: no escala a multi-instance. OK por ahora (Vercel free = 1 instancia). Si se migra a pro, usar Upstash Redis.
8. **`TouchSensor({ delay: 250 })`** es obligatorio en CollectionGrid — sin él el drag compite con el scroll de Safari iOS.

---

## Resumen de archivos

### Nuevos (46 archivos)
- `supabase/migrations/20260424_trading_system.sql`
- `src/types/index.ts` (modificado)
- `src/app/api/cards/inventory/route.ts` + `__tests__/`
- `src/app/api/market/listings/route.ts` + `__tests__/`
- `src/app/api/market/listings/[id]/route.ts` + `__tests__/`
- `src/app/api/market/listings/[id]/offers/route.ts` + `__tests__/`
- `src/app/api/market/listings/[id]/offers/[offerId]/route.ts` + `__tests__/`
- `src/app/api/market/listings/[id]/offers/[offerId]/accept/route.ts` + `__tests__/`
- `src/app/api/market/expire/route.ts` + `__tests__/`
- `src/app/api/wishlist/route.ts` + `__tests__/`
- `src/app/api/wishlist/[cardId]/route.ts`
- `src/hooks/useInventory.ts` + `__tests__/`
- `src/hooks/useMarket.ts` + `__tests__/`
- `src/hooks/useTradeHistory.ts` + `__tests__/`
- `src/hooks/useWishlist.ts` + `__tests__/`
- `src/components/collection/CardItem.tsx`
- `src/components/collection/CardDropZone.tsx`
- `src/components/collection/CollectionGrid.tsx`
- `src/components/market/RarityPointsBadge.tsx`
- `src/components/market/ListingModal.tsx` + `__tests__/`
- `src/components/market/OfferModal.tsx` + `__tests__/`
- `src/components/market/TradeConfirmModal.tsx`
- `src/components/market/MarketCard.tsx`
- `src/components/market/MarketListingView.tsx`
- `src/components/market/OfferCard.tsx`
- `src/components/market/OfferList.tsx`
- `src/components/wishlist/WishlistHeart.tsx`
- `src/components/wishlist/WishlistGrid.tsx`
- `src/components/trade/TradeHistoryItem.tsx`
- `src/app/(main)/market/page.tsx`
- `src/app/(main)/market/[listingId]/page.tsx`
- `src/app/(main)/market/my-listings/page.tsx`
- `src/app/(main)/market/history/page.tsx`
- `src/app/(main)/wishlist/page.tsx`

### Modificados
- `src/types/index.ts` — tipos trading + `NotificationType` extendido + `Notification` extendido
- `src/hooks/usePacks.ts` — referencias a `card_id` → `card_definition_id`
- `src/app/(main)/collection/page.tsx` — `useInventory` + `CollectionGrid`
- `src/components/` (notificaciones) — 6 nuevos tipos de notificación
- `src/components/ProfileView.tsx` — link a historial de trades
- `package.json` — `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`

---

## Próxima fase recomendada

`sdd-apply Fase 1` — Infraestructura DB (migration SQL + tipos TypeScript).
