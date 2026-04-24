# Proposal — Trading System (Sistema de Intercambio de Fotocards)

**Change name**: `trading-system`
**Status**: proposed
**Author**: SDD exploration + propose phase
**Stack**: Next.js 16 App Router, TypeScript, Bun, Supabase, React Query v5, Zustand v5, Framer Motion, Tailwind v4
**Reference**: `docs/trading-system-plan.md`

---

## 1. Intent

### Problema a resolver
La app ya tiene un sistema de colección de fotocards (tabla `cards`, `user_cards`, sobres con `pack_log`), pero las cartas son un activo estático: se ganan y se quedan. No existe ningún mecanismo para que los usuarios intercambien cartas, lo que limita el engagement a largo plazo: una vez que el usuario completa las cartas más accesibles, pierde motivación para abrir más sobres.

### Por qué ahora
- El sistema de packs está estable y en producción (award, open, pending, login-streak).
- La columna `for_trade` ya existe en `user_cards`, señalando que este feature estaba planeado desde el diseño inicial.
- Hay demanda de un loop social: "conseguir la que te falta" es la mecánica clásica que convierte colección en economía comunitaria.
- Tenemos notificaciones + realtime en producción, la base para un mercado vivo.

### Métricas de éxito
- > 20% de usuarios con >5 cartas listan al menos una en el mercado en las primeras 2 semanas.
- > 40% de listings reciben al menos una oferta dentro del período de expiración (30 días).
- Aumento > 15% en sobres abiertos/usuario/semana post-lanzamiento (loop reactivado).

---

## 2. Scope

### In scope
- Migración del modelo `user_cards` de "una fila por instancia" a "fila por definición con `quantity` + `locked_quantity`" (con script de migración idempotente).
- Sistema de puntos por rareza con tabla `rarity_points` derivada.
- Listado de cartas en mercado global con modo de aceptación (manual / auto).
- Ofertas 1-a-1 (una carta ofrecida por oferta, sin ofertas mixtas).
- Intercambio atómico vía transacción SQL (stored procedure / RPC).
- Wishlist de cartas deseadas con notificaciones cuando aparecen en mercado.
- Historial inmutable de intercambios (`trade_history`).
- Expiración automática de listings a los 30 días (cron existente en `src/app/api/cron/`).
- Drag & drop con `@dnd-kit` (mouse + touch con delay 250ms).
- Integración con sistema de notificaciones existente (nuevos `notification_type`).
- Realtime para ofertas entrantes en listings propios (Supabase Realtime).

### Out of scope (fase 1)
- Intercambio directo usuario-a-usuario (solo vía mercado).
- Filtros por era / álbum / miembro en el mercado (mercado global).
- Ofertas mixtas (varias cartas a cambio de una).
- Sistema de reputación de traders.
- Mercado con puntos virtuales (el intercambio es 1-carta-por-1-carta).
- Límite de listings por usuario.
- Integración con notificaciones push Expo para eventos de trading (puede venir en fase posterior; por ahora, solo notificaciones in-app vía tabla `notifications`).

### Asunciones
- El esquema actual `user_cards(id, user_id, card_id, for_trade, obtained_at)` es migrable sin pérdida: se hace un `GROUP BY (user_id, card_id)` y se genera la nueva tabla con `quantity`.
- `for_trade` puede descontinuarse después de la migración (las listings viven en `market_listings`).
- Hay menos de 100k filas en `user_cards` (migración factible en un solo batch).

---

## 3. Approach

### 3.1 Modelo de datos — decisión clave: migrar a por-cantidad

**Motivo**: el plan y la economía del trading asumen que las cartas duplicadas stackean (`×3`), se lockean parcialmente (`locked_quantity`), y se intercambian como unidades fungibles. Mantener instancias individuales complica cada query y cada validación sin beneficio (no hay "serial number" por carta).

#### Nuevas tablas y cambios

```sql
-- 1. Agregar columna rarity_points a `cards` (derivada de `rarity`)
ALTER TABLE cards ADD COLUMN rarity_points smallint;

UPDATE cards SET rarity_points = CASE rarity
  WHEN 'legendary' THEN 16
  WHEN 'epic'      THEN 8
  WHEN 'rare'      THEN 4
  WHEN 'uncommon'  THEN 2  -- si existe
  WHEN 'common'    THEN 1
END;

ALTER TABLE cards ALTER COLUMN rarity_points SET NOT NULL;

-- 2. Nueva tabla user_cards_v2 (reemplaza user_cards)
CREATE TABLE user_cards_v2 (
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  card_id uuid NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  quantity smallint NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  locked_quantity smallint NOT NULL DEFAULT 0 CHECK (locked_quantity >= 0 AND locked_quantity <= quantity),
  first_obtained_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, card_id)
);

-- Índice para queries de colección
CREATE INDEX idx_user_cards_v2_user ON user_cards_v2(user_id);

-- 3. Migración de datos (idempotente)
INSERT INTO user_cards_v2 (user_id, card_id, quantity, first_obtained_at)
SELECT user_id, card_id, COUNT(*)::smallint, MIN(obtained_at)
FROM user_cards
GROUP BY user_id, card_id
ON CONFLICT (user_id, card_id) DO NOTHING;

-- 4. Rename: user_cards -> user_cards_legacy, user_cards_v2 -> user_cards
-- (en migración separada tras validar datos)

-- 5. Market listings
CREATE TABLE market_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  card_id uuid NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  auto_accept boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','expired','cancelled')),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX idx_market_listings_status ON market_listings(status, expires_at);
CREATE INDEX idx_market_listings_seller ON market_listings(seller_id, status);
CREATE INDEX idx_market_listings_card ON market_listings(card_id, status);

-- 6. Trade offers
CREATE TABLE trade_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES market_listings(id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  offered_card_id uuid NOT NULL REFERENCES cards(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  UNIQUE (listing_id, buyer_id, offered_card_id, status) -- previene ofertas duplicadas activas
);

CREATE INDEX idx_trade_offers_listing ON trade_offers(listing_id, status);
CREATE INDEX idx_trade_offers_buyer ON trade_offers(buyer_id, status);

-- 7. Trade history (inmutable)
CREATE TABLE trade_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES market_listings(id),
  seller_id uuid NOT NULL REFERENCES profiles(id),
  buyer_id uuid NOT NULL REFERENCES profiles(id),
  listed_card_id uuid NOT NULL REFERENCES cards(id),
  offered_card_id uuid NOT NULL REFERENCES cards(id),
  completed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_trade_history_seller ON trade_history(seller_id, completed_at DESC);
CREATE INDEX idx_trade_history_buyer  ON trade_history(buyer_id, completed_at DESC);

-- 8. Wishlists
CREATE TABLE wishlists (
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  card_id uuid NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, card_id)
);

CREATE INDEX idx_wishlists_card ON wishlists(card_id);

-- 9. RPC: ejecuta_intercambio atómico
CREATE OR REPLACE FUNCTION execute_trade(
  p_listing_id uuid,
  p_offer_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_listing market_listings;
  v_offer trade_offers;
  v_listed_points smallint;
  v_offered_points smallint;
BEGIN
  -- Lock listing y offer para prevenir race conditions
  SELECT * INTO v_listing FROM market_listings WHERE id = p_listing_id FOR UPDATE;
  IF v_listing.status != 'active' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'listing_not_active');
  END IF;

  SELECT * INTO v_offer FROM trade_offers WHERE id = p_offer_id FOR UPDATE;
  IF v_offer.status != 'pending' OR v_offer.listing_id != p_listing_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'offer_invalid');
  END IF;

  -- Validar puntos
  SELECT rarity_points INTO v_listed_points FROM cards WHERE id = v_listing.card_id;
  SELECT rarity_points INTO v_offered_points FROM cards WHERE id = v_offer.offered_card_id;
  IF v_offered_points < v_listed_points THEN
    RETURN jsonb_build_object('ok', false, 'error', 'insufficient_points');
  END IF;

  -- Transferir carta listada: seller -> buyer
  UPDATE user_cards SET quantity = quantity - 1
    WHERE user_id = v_listing.seller_id AND card_id = v_listing.card_id;
  INSERT INTO user_cards (user_id, card_id, quantity)
    VALUES (v_offer.buyer_id, v_listing.card_id, 1)
    ON CONFLICT (user_id, card_id) DO UPDATE SET quantity = user_cards.quantity + 1;

  -- Transferir carta ofrecida: buyer -> seller (descontar locked también)
  UPDATE user_cards
    SET quantity = quantity - 1, locked_quantity = locked_quantity - 1
    WHERE user_id = v_offer.buyer_id AND card_id = v_offer.offered_card_id;
  INSERT INTO user_cards (user_id, card_id, quantity)
    VALUES (v_listing.seller_id, v_offer.offered_card_id, 1)
    ON CONFLICT (user_id, card_id) DO UPDATE SET quantity = user_cards.quantity + 1;

  -- Cerrar listing y ofertas
  UPDATE market_listings SET status = 'completed', completed_at = now() WHERE id = p_listing_id;
  UPDATE trade_offers SET status = 'accepted', resolved_at = now() WHERE id = p_offer_id;

  -- Rechazar el resto, liberando locks
  UPDATE user_cards uc
    SET locked_quantity = locked_quantity - 1
  FROM trade_offers o
  WHERE o.listing_id = p_listing_id
    AND o.status = 'pending'
    AND o.id != p_offer_id
    AND uc.user_id = o.buyer_id
    AND uc.card_id = o.offered_card_id;

  UPDATE trade_offers
    SET status = 'rejected', resolved_at = now()
    WHERE listing_id = p_listing_id AND status = 'pending' AND id != p_offer_id;

  -- Registrar en historial
  INSERT INTO trade_history (listing_id, seller_id, buyer_id, listed_card_id, offered_card_id)
    VALUES (p_listing_id, v_listing.seller_id, v_offer.buyer_id, v_listing.card_id, v_offer.offered_card_id);

  RETURN jsonb_build_object('ok', true);
END;
$$;
```

### 3.2 Nuevas API routes

| Ruta | Método | Descripción |
|------|--------|-------------|
| `/api/market/listings` | GET | Listado paginado de cartas activas en el mercado (filtros opcionales: rarity, member, era). |
| `/api/market/listings` | POST | Crear un listing. Body: `{ card_id, auto_accept }`. Valida que el user tenga `quantity > locked_quantity` y decrementa `quantity`. |
| `/api/market/listings/[id]` | DELETE | Cancelar listing propio (solo `status = 'active'`). Devuelve la carta al inventario. |
| `/api/market/listings/[id]/offers` | GET | Ofertas recibidas (solo seller). |
| `/api/market/listings/[id]/offers` | POST | Crear oferta. Body: `{ offered_card_id }`. Valida puntos y lockea la carta. Si listing es auto-accept, ejecuta trade inmediatamente. |
| `/api/market/offers/[id]/accept` | POST | Aceptar oferta (solo seller, modo manual). Llama RPC `execute_trade`. |
| `/api/market/offers/[id]/reject` | POST | Rechazar oferta individual. Libera lock. |
| `/api/market/offers/[id]` | DELETE | Cancelar oferta propia (solo buyer, antes de ser aceptada). |
| `/api/market/history` | GET | Historial del usuario (combinando ofertas aceptadas como seller y como buyer). |
| `/api/wishlist` | GET | Wishlist del usuario autenticado. |
| `/api/wishlist` | POST | Agregar carta. Body: `{ card_id }`. |
| `/api/wishlist/[card_id]` | DELETE | Remover carta. |
| `/api/cron/expire-listings` | GET | Cron job que marca listings con `expires_at < now()` como `expired`, libera locks de sus ofertas, y envía notificación al seller. |

Todos los endpoints de escritura:
- Validan sesión con `createClient()` server-side.
- Usan `admin()` client para writes que requieren bypass de RLS.
- Aplican rate limiting (`rateLimit` helper existente).
- Validan ownership de recursos.

### 3.3 Nuevos hooks (React Query v5)

```
src/hooks/useMarket.ts
  - useMarketListings(filters?)       → GET listado
  - useMyListings()                   → GET mis listings activos
  - useCreateListing()                → POST listing
  - useCancelListing()                → DELETE listing
  - useListingOffers(listingId)       → GET ofertas (seller)
  - useCreateOffer()                  → POST oferta
  - useAcceptOffer()                  → POST accept
  - useRejectOffer()                  → POST reject
  - useCancelOffer()                  → DELETE oferta propia

src/hooks/useTradeHistory.ts
  - useTradeHistory(userId)           → GET historial

src/hooks/useWishlist.ts
  - useWishlist(userId)               → GET wishlist
  - useAddToWishlist()                → POST
  - useRemoveFromWishlist()           → DELETE

src/hooks/useRealtimeMarket.ts
  - useRealtimeOffers(listingId)      → subscribe a INSERT en trade_offers del listing
```

### 3.4 Nuevos componentes y páginas

```
src/app/(main)/market/page.tsx                → Grid de listings activos, filtros
src/app/(main)/market/[listingId]/page.tsx    → Detalle + formulario de oferta
src/app/(main)/market/my-listings/page.tsx    → Gestión de mis listings y ofertas recibidas
src/app/(main)/wishlist/page.tsx              → Mi wishlist
src/app/(main)/trade-history/page.tsx         → Historial de intercambios

src/components/market/
  - CardDraggable.tsx          → Carta draggable (usa useDraggable de @dnd-kit)
  - MarketDropZone.tsx         → Zona "soltar acá para listar"
  - OfferDropZone.tsx          → Zona "soltar acá para ofertar"
  - ListingCard.tsx            → Card presentacional de listing
  - OfferCard.tsx              → Card presentacional de oferta
  - ListingFormModal.tsx       → Modal config (auto/manual)
  - OfferReviewModal.tsx       → Modal seller para revisar oferta
  - RarityPointsBadge.tsx      → Badge visual de puntos
  - WishlistHeart.tsx          → Toggle wishlist en tarjeta
  - TradeHistoryItem.tsx       → Fila del historial
```

### 3.5 Dependencias a agregar

```json
"@dnd-kit/core": "^6.3.1",
"@dnd-kit/sortable": "^10.0.0",
"@dnd-kit/utilities": "^3.2.2"
```

Se instalan con `bun add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`.

### 3.6 Integración con sistema de notificaciones

**Extender** `NotificationType` en `src/types/index.ts`:
```ts
export type NotificationType =
  | "like" | "comentario" | "post"
  | "friend_request" | "friend_accept"
  | "poll_vote" | "poll_ended"
  | "trade_offer_received"   // vendedor recibe oferta
  | "trade_offer_accepted"   // comprador: su oferta ganó
  | "trade_offer_rejected"   // comprador: su oferta fue rechazada
  | "wishlist_card_listed"   // carta de wishlist aparece en mercado
  | "listing_expired"        // tu listing expiró
  | "trade_match_suggested"; // match bidireccional sugerido
```

Actualizar `src/app/api/notifications/push/route.ts` para agregar `MESSAGES` de cada tipo. Estos se insertan en la tabla `notifications` desde las API routes o desde triggers de Supabase.

### 3.7 Realtime
- Supabase Realtime channel `realtime-listing-{id}` escucha INSERT en `trade_offers` filtrado por `listing_id`.
- El vendedor en `my-listings/[id]` ve ofertas nuevas en vivo sin refresh.

### 3.8 Tipos nuevos en `src/types/index.ts`

```ts
export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";
export type ListingStatus = "active" | "completed" | "expired" | "cancelled";
export type OfferStatus = "pending" | "accepted" | "rejected" | "cancelled";

export interface Card {
  id: string;
  name: string;
  member: string | null;
  era: string | null;
  rarity: Rarity;
  rarity_points: number;
  image_url: string;
}

export interface UserCardEntry {
  user_id: string;
  card_id: string;
  quantity: number;
  locked_quantity: number;
  first_obtained_at: string;
  cards: Card;
}

export interface MarketListing {
  id: string;
  seller_id: string;
  card_id: string;
  auto_accept: boolean;
  status: ListingStatus;
  expires_at: string;
  created_at: string;
  completed_at: string | null;
  cards: Card;
  profiles?: Profile;
}

export interface TradeOffer {
  id: string;
  listing_id: string;
  buyer_id: string;
  offered_card_id: string;
  status: OfferStatus;
  created_at: string;
  resolved_at: string | null;
  offered_card?: Card;
  profiles?: Profile;
}

export interface TradeHistoryEntry {
  id: string;
  listing_id: string;
  seller_id: string;
  buyer_id: string;
  listed_card_id: string;
  offered_card_id: string;
  completed_at: string;
  listed_card?: Card;
  offered_card?: Card;
  seller?: Profile;
  buyer?: Profile;
}

export interface WishlistEntry {
  user_id: string;
  card_id: string;
  created_at: string;
  cards?: Card;
}
```

---

## 4. Rollback plan

### Antes del deploy
- Migración en staging con snapshot de producción. Validar:
  - `SUM(quantity)` de `user_cards_v2` por usuario = `COUNT(*)` de `user_cards` original por usuario.
  - No hay registros con `locked_quantity > quantity`.
  - RPC `execute_trade` retorna error esperado en casos inválidos.

### Post-deploy si aparecen problemas críticos
1. **Feature flag**: `NEXT_PUBLIC_TRADING_ENABLED=false` desactiva los links a `/market`, `/wishlist`, `/trade-history` en `NavigationCard.tsx` y oculta zonas de drop. Las API routes devuelven 503.
2. **Rollback de schema**: los renames son reversibles (`ALTER TABLE ... RENAME`). Mantener `user_cards_legacy` durante mínimo 2 semanas.
3. **Rollback de código**: `git revert` del merge commit, redeploy. Los datos ya migrados de `user_cards_v2` permanecen pero sin efecto hasta reactivar.
4. **Cleanup de locks huérfanos**: si se encuentran `locked_quantity` inconsistentes, ejecutar:
```sql
UPDATE user_cards uc SET locked_quantity = (
  SELECT COALESCE(COUNT(*), 0) FROM trade_offers o
  WHERE o.buyer_id = uc.user_id
    AND o.offered_card_id = uc.card_id
    AND o.status = 'pending'
);
```

---

## 5. Risks

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| Migración pierde cartas | Baja | Crítico | Backup antes de migrar, validar sumas, mantener `user_cards_legacy` 2 semanas. |
| Race conditions en intercambio atómico | Media | Alto | `FOR UPDATE` en RPC, test de concurrencia con k6 o similar. |
| `locked_quantity` se desincroniza | Media | Medio | Query de reconciliación en cron diario, alertas si se detecta inconsistencia. |
| `@dnd-kit` no funciona bien en algunos mobiles | Media | Medio | Delay 250ms en TouchSensor, testing en iOS Safari + Chrome Android. Fallback: botón "Listar" sin drag. |
| Spam de ofertas | Media | Medio | Rate limit en POST `/api/market/listings/[id]/offers` (ej: 5/minuto/user), UNIQUE constraint en ofertas activas. |
| Notificaciones inundadas para power users | Alta | Bajo | Agrupación en UI ("3 ofertas nuevas en tu listing de X"), toggle de notifs por tipo (fuera de scope fase 1). |
| Usuario borra cuenta con trades pendientes | Baja | Medio | `ON DELETE CASCADE` en FKs sensibles. Trade history conserva IDs aunque profile se borre (soft-handling en UI). |
| Listings fantasma si cron falla | Baja | Bajo | Cron monitoreado, query de expiración idempotente. |
| Complejidad de UX drag & drop en mobile | Alta | Medio | Onboarding interactivo en primer uso, testing con usuarios reales. |

---

## 6. Phasing

### Fase 1 — Foundation: DB + API core (semana 1-2)
- Migración de schema (cards.rarity_points, user_cards_v2, market_listings, trade_offers, trade_history, wishlists).
- Script de migración de datos.
- RPC `execute_trade` con tests SQL.
- API routes: `/api/market/listings` (GET, POST), `/api/market/listings/[id]/offers` (POST).
- Hook `useMarketListings`.
- Tests: vitest para API routes (validación, rate limit, ownership).

**Deliverable**: se puede listar y ofertar vía API directamente. Sin UI todavía.

### Fase 2 — UI colección con stacking (semana 2-3)
- Refactor de `src/app/(main)/collection/page.tsx` para usar el nuevo modelo (cantidad + locked).
- Componente `CollectionCard` con badge `×N` y `🔒` si hay locks.
- Componente `RarityPointsBadge`.
- Actualizar `usePacks.ts` `useCollection` para el nuevo schema.

**Deliverable**: la colección muestra correctamente cantidades, sin cambios funcionales aún.

### Fase 3 — Mercado (semana 3-4)
- Página `/market` con grid de listings, filtros por rareza.
- Página `/market/my-listings` con gestión.
- Flujo de listar: drag de carta de colección → drop en zona mercado → modal config (auto/manual).
- Cron `/api/cron/expire-listings`.
- Realtime subscription en my-listings.

**Deliverable**: se puede listar y cancelar listings desde la UI.

### Fase 4 — Trading flow (semana 4-5)
- Página `/market/[listingId]` detalle con zona de oferta.
- Flujo de ofertar: drag de carta → drop en zona de oferta → validación de puntos → confirm.
- Modal de revisión de ofertas para seller (manual mode).
- Auto-accept mode: ejecución inmediata tras POST oferta válida.
- Página `/trade-history` con lista de intercambios completados.
- Integración de notificaciones (`trade_offer_received`, `trade_offer_accepted`, `trade_offer_rejected`).

**Deliverable**: flujo end-to-end de intercambio funcionando.

### Fase 5 — Wishlist + match engine (semana 5-6)
- Tabla `wishlists` y API routes.
- Página `/wishlist` y toggle `WishlistHeart` en cartas.
- Notificación `wishlist_card_listed`: trigger o job que al crear un listing busca wishlists que lo incluyan y notifica.
- Notificación `listing_expired`.
- Match engine (opcional, fase 5.5): job que detecta "yo tengo lo que vos querés y vos tenés lo que yo quiero" y notifica con `trade_match_suggested`.

**Deliverable**: wishlist funcional, notificaciones cerradas.

### Fase 6 (opcional, post-launch) — Pulido
- Métricas y admin dashboard en `/api/admin/stats`.
- Animaciones avanzadas (framer-motion) en aceptación de trade.
- Onboarding interactivo del sistema.
- Filtros adicionales en mercado (member, era).
- A/B testing de tasas de conversión.

---

## 7. Decisiones pendientes / cuestiones abiertas

1. **Rareza `uncommon`**: el plan menciona 5 rarities (con `uncommon` = 2 pts). El código actual solo tiene 4 (`common`, `rare`, `epic`, `legendary`). **Decisión sugerida**: mantener 4 rarities en fase 1 (puntos: 1 / 4 / 8 / 16), agregar `uncommon` en fase posterior si hace falta más granularidad. Documentarlo en spec.
2. **Columna `for_trade` actual**: deprecarla tras la migración. Marcar columna como obsoleta, eliminar en cleanup posterior.
3. **Realtime vs polling**: Supabase Realtime requiere habilitar replication en la tabla `trade_offers`. Si hay costo/riesgo, fallback a `refetchInterval: 15_000` en React Query.
4. **Ejecución del match engine**: si es costoso (N×M users), considerar job diario en lugar de tiempo real.
5. **Migración en ventana de mantenimiento**: dado que es destructiva (rename), coordinar una ventana de deploy. Alternativa: dual-write durante periodo de transición (más complejo).

---

## 8. Next phase

`sdd-spec` — escribir requirements y scenarios en formato spec delta, cubriendo al menos:
- Capacidad: gestión de listings.
- Capacidad: ofertas y validación de puntos.
- Capacidad: intercambio atómico.
- Capacidad: wishlist y notificaciones.
- Capacidad: expiración.
