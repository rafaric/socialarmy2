# Coverage Gaps — Trading System

**Generado**: 2026-04-23
**Estado**: Fases 1-8 completadas | Tests: 227/228 (1 falla pre-existente en Avatar.test.tsx)

---

## Scenarios con cobertura completa (unit/integration tests)

Cubiertos por tests unitarios y de API routes existentes:

### F-02 — Listings
- Crear listing válido → `POST /api/market/listings` tests (route.test.ts)
- Crear listing con inventario insuficiente → `POST` tests, 422 available_quantity_insufficient
- Crear listing modo auto_accept → `POST` tests, campo auto_accept=true
- Cancelar listing propio → `DELETE /api/market/listings/[id]` tests
- Cancelar listing de otro usuario → 403 Forbidden test
- Cancelar listing ya completado → 409 listing_not_cancellable test

### F-03 — Ofertas
- Oferta con puntos insuficientes → `POST /api/market/listings/[id]/offers` tests, 422 insufficient_points
- Oferta sin disponibilidad → 422 available_quantity_insufficient test
- Vendedor intenta ofertar en su propio listing → 422 no_self_offer test
- Oferta sobre listing expirado → 422 listing_expired test

### F-07 — Cron
- Expiración sin autenticación → 401 test en `/api/market/expire`
- Idempotencia del cron → test de segunda llamada con processed=0

### Hooks — Lógica de optimistic updates
- useCreateListing: optimistic decrement de quantity, rollback en error → useMarket.test.ts
- useCreateOffer: optimistic increment de locked_quantity → useMarket.test.ts
- useCancelListing: invalidaciones correctas → useMarket.test.ts
- useAcceptOffer: invalidaciones correctas → useMarket.test.ts
- useCancelOffer: invalidaciones correctas → useMarket.test.ts

### Componentes UI
- RarityBadge: labels, puntos y colores por rareza → RarityBadge.test.tsx (nuevo)
- ListingModal: apertura, datos de carta, toggle auto_accept, onClose, useCreateListing → ListingModal.test.tsx (nuevo)
- OfferModal: filtrado por puntos/disponibilidad, selección, useCreateOffer → OfferModal.test.tsx (nuevo)

### Validaciones de lógica pura
- hasEnoughPoints (todos los pares de rareza) → trading-validation.test.ts (nuevo)
- hasAvailableQuantity (casos edge) → trading-validation.test.ts (nuevo)
- RARITY_POINTS consistency (4 valores, valores correctos) → trading-validation.test.ts (nuevo)

---

## Scenarios que REQUIEREN integración real (DB/RPCs) — sin cobertura unit

Estos scenarios dependen de la ejecución real de funciones PostgreSQL (`execute_trade`, `create_listing`, etc.) y no pueden cubrirse con mocks de vitest. Requieren tests de integración con Supabase local o pg-mem:

### F-01 — Inventario (migración DB)
- **Vista de colección con stacking**: migración de user_cards a user_cards_v2 con GROUP BY — requiere Postgres real para verificar quantity, locked_quantity y first_obtained_at
- **Validación de suma post-migración**: SUM(quantity) = COUNT(*) legacy — bloque DO $$ en SQL, solo verificable con DB real
- **Consistencia de locked_quantity**: crear 2 ofertas y que locked_quantity=2, tercera oferta rechazada — depende de las RPCs create_offer y la constraint UNIQUE(listing_id, buyer_id, offered_card_id, status) en DB
- **Rollback de migración**: detección de inconsistencia → RAISE EXCEPTION → rollback — solo verificable con Postgres real

### F-03 — Ofertas (flujos completos)
- **Oferta válida (puntos suficientes)**: flujo completo — locked_quantity += 1 en DB, notificación trade_offer_received insertada en notifications — depende de la RPC create_offer en Supabase
- **Cancelar oferta propia**: locked_quantity -= 1 real en DB, listing sigue activo — depende de RPC cancel_offer
- **Auto-accept — ejecución inmediata**: execute_trade dentro de la misma request, cartas transferidas en DB — depende de RPC execute_trade completa

### F-04 — Intercambio atómico
- **Accept manual exitoso**: transferencia de cartas, cascade de rechazos, trade_history insertada, notificaciones — todo depende de execute_trade con FOR UPDATE locks en Postgres real
- **Race condition — doble accept simultáneo**: concurrencia real, FOR UPDATE lock competition — solo reproducible con conexiones PostgreSQL paralelas reales
- **Accept con listing ya completado**: execute_trade retorna ok=false "listing_not_active" — depende del estado real del listing en DB
- **Reject de oferta individual**: locked_quantity -= 1 real, notificación trade_offer_rejected — depende de API route y DB
- **Atomicidad — falla a mitad de transferencia**: ROLLBACK de transacción Postgres en error de timeout/deadlock — solo verificable con Postgres real

### F-05 — Wishlist
- **Agregar carta a wishlist**: INSERT en wishlists con RLS del cliente — depende de Supabase client-side con auth real
- **Agregar carta duplicada**: constraint UNIQUE en DB → 409 — depende de DB
- **Quitar carta de wishlist**: DELETE con RLS — depende de Supabase auth real
- **Notificación cuando aparece carta en mercado**: create_listing dispara búsqueda de wishlist y genera notificaciones — lógica dentro de la RPC create_listing en Postgres
- **Notificación no se duplica en 24h**: cooldown con timestamp en DB — lógica dentro de la RPC

### F-06 — Notificaciones
- **Notificación trade_offer_received**: INSERT en notifications table — depende de create_offer RPC
- **Notificación en auto-accept (no hay trade_offer_received)**: condicional en la RPC — depende de DB
- **Reject cascade genera notificaciones masivas**: execute_trade → notificaciones en cascade para múltiples buyers — depende de execute_trade en Postgres real

### F-07 — Expiración
- **Expiración sin ofertas**: listing → expired, quantity += 1, notificación — depende de expire_listings() RPC en Postgres
- **Expiración con múltiples ofertas**: cascade de cancel en ofertas, locked_quantity liberado — depende de expire_listings() con Postgres real

---

## Resumen de cobertura

| Feature | Scenarios totales | Cubiertos por unit tests | Solo integración |
|---------|------------------|--------------------------|--------------------|
| F-01 Inventario | 4 | 0 | 4 |
| F-02 Listings | 6 | 6 | 0 |
| F-03 Ofertas | 7 | 4 | 3 |
| F-04 Intercambio | 5 | 0 | 5 |
| F-05 Wishlist | 5 | 0 | 5 |
| F-06 Notificaciones | 4 | 0 | 4 |
| F-07 Expiración | 4 | 2 | 2 |
| **Total** | **35** | **12** | **23** |

> Los 23 scenarios de integración dependen de la ejecución real de RPCs PostgreSQL, que no pueden simularse fielmente con mocks de vitest. La estrategia correcta para cubrirlos es un entorno Supabase local (`supabase start`) con la migración `20260424_trading_system.sql` aplicada, o bien una suite de integración separada con `pg-mem`.

---

## Tests nuevos escritos en Fase 8

| Archivo | Tests |
|---------|-------|
| `src/components/market/__tests__/RarityBadge.test.tsx` | 13 tests |
| `src/components/market/__tests__/ListingModal.test.tsx` | 15 tests |
| `src/components/market/__tests__/OfferModal.test.tsx` | 15 tests |
| `src/lib/__tests__/trading-validation.test.ts` | 21 tests |
| `src/lib/trading.ts` | Funciones puras exportadas |
| **Total nuevos** | **64 tests** |
