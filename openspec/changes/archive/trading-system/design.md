# Design — Trading System (Diseño Técnico)

**Change name**: `trading-system`
**Status**: design
**Based on**: proposal.md, spec.md
**Stack**: Next.js 16 App Router, TypeScript, Bun, Supabase (Postgres + Realtime + pg_cron), React Query v5, Zustand v5, Framer Motion, Tailwind v4, @dnd-kit
**Fecha**: 2026-04-23

---

## 0. Decisiones congeladas (no reabrir)

Estas decisiones bajaron desde la fase de propuesta y están cerradas para esta fase de diseño:

| Decisión | Valor |
|----------|-------|
| Migración del schema `user_cards` | **Directa**. No hay usuarios activos en producción. No se conserva `user_cards_legacy`, no hay dual-write. |
| Orquestador de cron | **pg_cron de Supabase** corriendo cada hora. No se usa Vercel Cron (plan gratuito limita a 1/día). |
| Realtime | Solo en `trade_offers`, habilitado en Fase 3. Hasta entonces el diseño NO asume realtime. |
| Rarezas | 4 niveles: `common` (1 pt), `rare` (4 pts), `epic` (8 pts), `legendary` (16 pts). Sin `uncommon`. |
| Ofertas | Una carta por oferta. No se aceptan ofertas mixtas. |
| Mercado | Global. Sin filtros por era / miembro / álbum en fase 1. |

El documento asume estas decisiones sin volver a discutirlas.

---

## 1. Esquema de base de datos (DDL completo)

El orden de ejecución importa: cada bloque depende del anterior. Todo corre como una única migración idempotente en Supabase (preferentemente `supabase/migrations/2026XXXX_trading_system.sql`).

### 1.1 Agregar `rarity_points` a `cards`

```sql
-- Paso 1: columna derivada de `rarity`
ALTER TABLE public.cards
  ADD COLUMN IF NOT EXISTS rarity_points smallint;

UPDATE public.cards SET rarity_points = CASE rarity
  WHEN 'legendary' THEN 16
  WHEN 'epic'      THEN 8
  WHEN 'rare'      THEN 4
  WHEN 'common'    THEN 1
  ELSE 1
END
WHERE rarity_points IS NULL;

ALTER TABLE public.cards
  ALTER COLUMN rarity_points SET NOT NULL;

-- Trigger para mantener `rarity_points` sincronizado si se inserta/actualiza `rarity`
CREATE OR REPLACE FUNCTION public.sync_card_rarity_points()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.rarity_points := CASE NEW.rarity
    WHEN 'legendary' THEN 16
    WHEN 'epic'      THEN 8
    WHEN 'rare'      THEN 4
    WHEN 'common'    THEN 1
    ELSE 1
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_card_rarity_points ON public.cards;
CREATE TRIGGER trg_sync_card_rarity_points
BEFORE INSERT OR UPDATE OF rarity ON public.cards
FOR EACH ROW EXECUTE FUNCTION public.sync_card_rarity_points();
```

### 1.2 Migración directa de `user_cards`

La tabla actual tiene `(id, user_id, card_id, for_trade, obtained_at)` con una fila por instancia. La migración directa la reemplaza por el modelo stacked.

```sql
-- Paso 2: snapshot de datos actuales a una tabla temporal
CREATE TABLE IF NOT EXISTS public._user_cards_snapshot AS
  SELECT user_id, card_id, COUNT(*)::smallint AS quantity, MIN(obtained_at) AS first_obtained_at
  FROM public.user_cards
  GROUP BY user_id, card_id;

-- Paso 3: drop de la tabla vieja (decisión: migración directa sin legacy)
DROP TABLE IF EXISTS public.user_cards CASCADE;

-- Paso 4: recrear user_cards con el nuevo schema
CREATE TABLE public.user_cards (
  user_id             uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  card_definition_id  uuid        NOT NULL REFERENCES public.cards(id)    ON DELETE CASCADE,
  quantity            smallint    NOT NULL DEFAULT 0,
  locked_quantity     smallint    NOT NULL DEFAULT 0,
  first_obtained_at   timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, card_definition_id),
  CONSTRAINT user_cards_quantity_nonneg     CHECK (quantity >= 0),
  CONSTRAINT user_cards_locked_nonneg       CHECK (locked_quantity >= 0),
  CONSTRAINT user_cards_locked_le_quantity  CHECK (locked_quantity <= quantity)
);

CREATE INDEX idx_user_cards_user              ON public.user_cards(user_id);
CREATE INDEX idx_user_cards_card              ON public.user_cards(card_definition_id);
CREATE INDEX idx_user_cards_user_available    ON public.user_cards(user_id)
  WHERE quantity > locked_quantity;

-- Paso 5: restaurar datos desde el snapshot
INSERT INTO public.user_cards (user_id, card_definition_id, quantity, locked_quantity, first_obtained_at)
SELECT user_id, card_id, quantity, 0, first_obtained_at
FROM public._user_cards_snapshot;

-- Paso 6: validación dura. Si falla, la transacción hace rollback.
DO $$
DECLARE
  v_new_sum integer;
  v_snap_sum integer;
BEGIN
  SELECT COALESCE(SUM(quantity), 0) INTO v_new_sum FROM public.user_cards;
  SELECT COALESCE(SUM(quantity), 0) INTO v_snap_sum FROM public._user_cards_snapshot;
  IF v_new_sum <> v_snap_sum THEN
    RAISE EXCEPTION 'Migración inconsistente: new_sum=% snap_sum=%', v_new_sum, v_snap_sum;
  END IF;
END $$;

-- Paso 7: trigger updated_at
CREATE OR REPLACE FUNCTION public.touch_user_cards_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_touch_user_cards_updated_at ON public.user_cards;
CREATE TRIGGER trg_touch_user_cards_updated_at
BEFORE UPDATE ON public.user_cards
FOR EACH ROW EXECUTE FUNCTION public.touch_user_cards_updated_at();

-- Paso 8: cleanup del snapshot (opcional, post-validación manual)
-- DROP TABLE public._user_cards_snapshot;  -- mantener 1 sprint por seguridad
```

**Notas de la migración**:
- Usamos el nombre de columna `card_definition_id` (más explícito que `card_id`) porque la tabla `cards` modela definiciones de fotocards, no instancias.
- `updated_at` se mantiene automático para auditoría.
- El índice parcial `idx_user_cards_user_available` acelera queries "¿qué cartas disponibles tiene el user para listar / ofrecer?".

### 1.3 `market_listings`

```sql
CREATE TABLE public.market_listings (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id           uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  card_definition_id  uuid        NOT NULL REFERENCES public.cards(id)    ON DELETE RESTRICT,
  auto_accept         boolean     NOT NULL DEFAULT false,
  status              text        NOT NULL DEFAULT 'active',
  expires_at          timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_at          timestamptz NOT NULL DEFAULT now(),
  completed_at        timestamptz,
  CONSTRAINT market_listings_status_check
    CHECK (status IN ('active','completed','expired','cancelled'))
);

-- Un seller NO puede tener dos listings activos para la misma carta.
CREATE UNIQUE INDEX uniq_active_listing_per_seller_card
  ON public.market_listings(seller_id, card_definition_id)
  WHERE status = 'active';

CREATE INDEX idx_market_listings_active
  ON public.market_listings(status, expires_at)
  WHERE status = 'active';

CREATE INDEX idx_market_listings_seller
  ON public.market_listings(seller_id, status, created_at DESC);

CREATE INDEX idx_market_listings_card
  ON public.market_listings(card_definition_id, status);
```

### 1.4 `trade_offers`

```sql
CREATE TABLE public.trade_offers (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id          uuid        NOT NULL REFERENCES public.market_listings(id) ON DELETE CASCADE,
  buyer_id            uuid        NOT NULL REFERENCES public.profiles(id)        ON DELETE CASCADE,
  offered_card_id     uuid        NOT NULL REFERENCES public.cards(id)           ON DELETE RESTRICT,
  status              text        NOT NULL DEFAULT 'pending',
  created_at          timestamptz NOT NULL DEFAULT now(),
  resolved_at         timestamptz,
  CONSTRAINT trade_offers_status_check
    CHECK (status IN ('pending','accepted','rejected','cancelled'))
);

-- Un buyer NO puede tener dos ofertas activas con la misma carta en el mismo listing.
CREATE UNIQUE INDEX uniq_pending_offer_per_buyer_card_listing
  ON public.trade_offers(listing_id, buyer_id, offered_card_id)
  WHERE status = 'pending';

CREATE INDEX idx_trade_offers_listing_pending
  ON public.trade_offers(listing_id)
  WHERE status = 'pending';

CREATE INDEX idx_trade_offers_buyer
  ON public.trade_offers(buyer_id, status, created_at DESC);
```

### 1.5 `trade_history` (inmutable)

```sql
CREATE TABLE public.trade_history (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id          uuid        NOT NULL REFERENCES public.market_listings(id) ON DELETE RESTRICT,
  seller_id           uuid        NOT NULL REFERENCES public.profiles(id),
  buyer_id            uuid        NOT NULL REFERENCES public.profiles(id),
  listed_card_id      uuid        NOT NULL REFERENCES public.cards(id),
  offered_card_id     uuid        NOT NULL REFERENCES public.cards(id),
  completed_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_trade_history_seller ON public.trade_history(seller_id, completed_at DESC);
CREATE INDEX idx_trade_history_buyer  ON public.trade_history(buyer_id,  completed_at DESC);
```

### 1.6 `wishlists`

```sql
CREATE TABLE public.wishlists (
  user_id             uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  card_definition_id  uuid        NOT NULL REFERENCES public.cards(id)    ON DELETE CASCADE,
  created_at          timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, card_definition_id)
);

CREATE INDEX idx_wishlists_card ON public.wishlists(card_definition_id);
```

### 1.7 RLS — Row Level Security

Las API routes pueden usar el admin client para bypass, pero igual definimos RLS para las queries client-side (ej. `useInventory` con `supabase.from("user_cards")...`).

```sql
-- user_cards
ALTER TABLE public.user_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own cards"
  ON public.user_cards FOR SELECT
  USING (auth.uid() = user_id);

-- market_listings (mercado global, todo el mundo lee lo activo)
ALTER TABLE public.market_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone reads active listings"
  ON public.market_listings FOR SELECT
  USING (status = 'active' OR seller_id = auth.uid());

-- trade_offers: seller del listing ve sus ofertas, buyer ve las suyas
ALTER TABLE public.trade_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "seller reads offers on own listings"
  ON public.trade_offers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.market_listings l
      WHERE l.id = trade_offers.listing_id AND l.seller_id = auth.uid()
    )
  );

CREATE POLICY "buyer reads own offers"
  ON public.trade_offers FOR SELECT
  USING (buyer_id = auth.uid());

-- trade_history: las dos partes ven sus trades
ALTER TABLE public.trade_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "participants read own history"
  ON public.trade_history FOR SELECT
  USING (seller_id = auth.uid() OR buyer_id = auth.uid());

-- wishlists
ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own wishlist"
  ON public.wishlists FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "users insert own wishlist"
  ON public.wishlists FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users delete own wishlist"
  ON public.wishlists FOR DELETE
  USING (user_id = auth.uid());
```

**Importante**: todas las escrituras en `user_cards`, `market_listings`, `trade_offers`, `trade_history` se hacen exclusivamente desde API routes usando el admin client (`SUPABASE_SERVICE_ROLE_KEY`), nunca desde el cliente. Por eso no definimos policies de INSERT/UPDATE/DELETE en esas tablas — si alguien intenta escribir desde el browser, RLS bloquea por default.

### 1.8 RPC `execute_trade(p_offer_id)` — el corazón atómico

Ver sección 7 para el SQL completo. Aquí solo el hueco para seguir el orden.

### 1.9 pg_cron — expiración cada hora

Supabase expone `pg_cron` en el schema `cron`. El job llama a una función SQL que realiza la expiración en DB directamente (sin HTTP, sin Vercel).

```sql
-- Función que procesa la expiración (idempotente, batched implícitamente por una sola pasada)
CREATE OR REPLACE FUNCTION public.expire_listings()
RETURNS TABLE (processed integer, errors integer)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_listing RECORD;
  v_processed integer := 0;
  v_errors    integer := 0;
BEGIN
  FOR v_listing IN
    SELECT id, seller_id, card_definition_id
    FROM public.market_listings
    WHERE status = 'active' AND expires_at <= now()
    ORDER BY expires_at ASC
    LIMIT 500  -- batch por tick; el cron corre cada hora, suficiente para el volumen esperado
    FOR UPDATE SKIP LOCKED
  LOOP
    BEGIN
      -- 1. Liberar locks de todas las ofertas pending y cancelarlas
      UPDATE public.user_cards uc
        SET locked_quantity = locked_quantity - 1
      FROM public.trade_offers o
      WHERE o.listing_id = v_listing.id
        AND o.status = 'pending'
        AND uc.user_id = o.buyer_id
        AND uc.card_definition_id = o.offered_card_id;

      UPDATE public.trade_offers
        SET status = 'cancelled', resolved_at = now()
        WHERE listing_id = v_listing.id AND status = 'pending';

      -- 2. Devolver la carta al seller (upsert)
      INSERT INTO public.user_cards (user_id, card_definition_id, quantity)
        VALUES (v_listing.seller_id, v_listing.card_definition_id, 1)
        ON CONFLICT (user_id, card_definition_id)
        DO UPDATE SET quantity = public.user_cards.quantity + 1;

      -- 3. Marcar listing como expired
      UPDATE public.market_listings
        SET status = 'expired', completed_at = now()
        WHERE id = v_listing.id;

      -- 4. Crear notificación listing_expired
      INSERT INTO public.notifications (notification_type, user_emisor, user_receptor, post_id)
        VALUES ('listing_expired', NULL, v_listing.seller_id, NULL);

      v_processed := v_processed + 1;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
      RAISE WARNING 'expire_listings error on listing %: %', v_listing.id, SQLERRM;
    END;
  END LOOP;

  RETURN QUERY SELECT v_processed, v_errors;
END;
$$;

-- Schedule: cada hora en punto
SELECT cron.schedule(
  'trading-expire-listings-hourly',
  '0 * * * *',
  $$ SELECT public.expire_listings(); $$
);
```

**Notas**:
- `FOR UPDATE SKIP LOCKED` previene deadlocks si dos corridas solapan (improbable pero barato).
- La función es idempotente porque filtra `status = 'active'` — listings ya expirados no se reprocesan.
- Errores por listing individual no abortan el batch entero.
- La API route `POST /api/market/expire` existe igual como fallback administrativo (ver sección 3), usa la misma función.

### 1.10 Extensión de `notifications` para nuevos tipos

La tabla `notifications` ya existe con columnas `(id, notification_type, user_emisor, user_receptor, post_id, created_at, read)`. NO requiere ALTER de schema — los nuevos tipos son simplemente strings nuevos en `notification_type`. Sí requiere agregar `reference_id` si queremos navegación directa al listing/oferta. Decisión:

```sql
-- Opcional pero recomendado: referencia polimórfica para navegar
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS reference_id uuid,
  ADD COLUMN IF NOT EXISTS reference_type text;

-- Un check soft-enforced para los nuevos tipos
-- (no bloqueamos strings para no romper inserts existentes de 'like', 'post', etc.)
COMMENT ON COLUMN public.notifications.reference_id
  IS 'Para trading: listing_id o offer_id según reference_type. Null en notifs legacy.';
COMMENT ON COLUMN public.notifications.reference_type
  IS 'listing | offer | null';
```

---

## 2. Tipos TypeScript (`src/types/index.ts`)

Se agregan al final del archivo existente (después de `UploadValidateResponse`):

```ts
// ---------------------------------------------------------------------------
// Trading System
// ---------------------------------------------------------------------------

export type CardRarity = "common" | "rare" | "epic" | "legendary";

export type ListingStatus = "active" | "completed" | "expired" | "cancelled";
export type OfferStatus   = "pending" | "accepted" | "rejected" | "cancelled";

/** Definición de una fotocard (tabla `cards`). */
export interface Card {
  id: string;
  name: string;
  member: string | null;
  era: string | null;
  rarity: CardRarity;
  rarity_points: number;          // derivado: 1 / 4 / 8 / 16
  image_url: string;
}

/** Entrada del inventario del usuario (tabla `user_cards`). */
export interface UserCard {
  user_id: string;
  card_definition_id: string;
  quantity: number;               // total que posee
  locked_quantity: number;        // reservado por listings y ofertas pending
  first_obtained_at: string;
  updated_at: string;
  cards?: Card;                   // join opcional
}

export interface MarketListing {
  id: string;
  seller_id: string;
  card_definition_id: string;
  auto_accept: boolean;
  status: ListingStatus;
  expires_at: string;
  created_at: string;
  completed_at: string | null;
  cards?: Card;
  seller?: Profile;
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
  buyer?: Profile;
}

export interface TradeHistory {
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

export interface WishlistItem {
  user_id: string;
  card_definition_id: string;
  created_at: string;
  cards?: Card;
}

// ---------------------------------------------------------------------------
// Payloads de API
// ---------------------------------------------------------------------------

export type CreateListingPayload = { card_definition_id: string; auto_accept: boolean };
export type CreateOfferPayload   = { offered_card_id: string };

export type ListingsQuery = {
  rarity?: CardRarity;
  cursor?: string;                // created_at ISO
  limit?: number;                 // default 20
};

export type TradeApiError = {
  error: string;                  // ej: "insufficient_points", "listing_not_active"
  detail?: string;
};

// ---------------------------------------------------------------------------
// Notifications: extender el tipo existente (NO crear uno nuevo).
// ---------------------------------------------------------------------------
```

Y reemplazar la línea existente de `NotificationType`:

```ts
// Antes:
// export type NotificationType = "like" | "comentario" | "post" | "friend_request" | ...;

// Después:
export type NotificationType =
  | "like"
  | "comentario"
  | "post"
  | "friend_request"
  | "friend_accept"
  | "poll_vote"
  | "poll_ended"
  // Trading system:
  | "trade_offer_received"
  | "trade_offer_accepted"
  | "trade_offer_rejected"
  | "wishlist_card_listed"
  | "listing_expired"
  | "trade_match_suggested";
```

Y extender `Notification` con las columnas opcionales nuevas:

```ts
export interface Notification {
  id: string;
  notification_type: NotificationType;
  user_emisor: string | null;          // null en listing_expired (lo dispara el sistema)
  user_receptor: string;
  post_id: string | null;
  reference_id?: string | null;        // nuevo — listing_id u offer_id
  reference_type?: "listing" | "offer" | null;
  created_at: string;
  read: boolean;
  profiles?: Profile;
}
```

---

## 3. API Routes

Convenciones aplicadas a TODAS las routes (derivadas de `src/app/api/friends/request/route.ts`):

1. Validación de sesión con `createClient()` server-side. 401 si no hay user.
2. Rate limit con `rateLimit(buildKey("ruta", req, user.id), N, windowMs)`. 429 + header `Retry-After` si excede.
3. Validación de input con regex UUID para IDs y tipos estrictos (boolean, number) para el resto. 400 si input es inválido.
4. Writes se hacen con `admin()` (service role) para bypass de RLS.
5. Errores de regla de negocio devuelven 422 con código textual (`insufficient_points`, `listing_not_active`, etc.).
6. Logging con `console.warn("[<tag>] route=<nombre> userId=%s ...", ...)`.

### 3.1 `GET /api/market/listings`

| Propiedad | Valor |
|-----------|-------|
| Path | `src/app/api/market/listings/route.ts` |
| Método | GET |
| Auth | Requiere sesión |
| Input | Query: `?rarity=epic&cursor=2026-04-20T00:00:00Z&limit=20` |
| Output 200 | `{ listings: MarketListing[], next_cursor: string \| null }` |
| Rate limit | 60/min/user (lectura barata) |
| Validaciones | `limit` entre 1 y 50, `rarity` en enum, `cursor` ISO válido |
| Query | `market_listings` JOIN `cards`, JOIN `profiles` as seller. Filtro `status='active'` + `expires_at > now()`. Orden `created_at DESC`. |

### 3.2 `POST /api/market/listings`

| Propiedad | Valor |
|-----------|-------|
| Path | `src/app/api/market/listings/route.ts` |
| Método | POST |
| Auth | Requiere sesión |
| Input | `{ card_definition_id: string (UUID), auto_accept: boolean }` |
| Output 201 | `{ listing: MarketListing }` |
| Output 422 | `{ error: "available_quantity_insufficient" \| "duplicate_active_listing" }` |
| Rate limit | 10/min/user |
| Validaciones | UUID válido, boolean estricto para `auto_accept`, seller posee la carta con `quantity - locked_quantity >= 1` |
| Side effects | `UPDATE user_cards SET quantity = quantity - 1 WHERE user_id=seller AND card_definition_id=X` + `INSERT market_listings`. Ambos en una transacción RPC `create_listing`. |

La carta se **decrementa de `quantity`** (no solo lockea), porque sale del inventario al ser listada (spec F-02).

### 3.3 `DELETE /api/market/listings/[id]`

| Propiedad | Valor |
|-----------|-------|
| Path | `src/app/api/market/listings/[id]/route.ts` |
| Método | DELETE |
| Auth | Requiere sesión + ownership (seller_id = user.id) |
| Input | Param `[id]` = listing UUID |
| Output 200 | `{ ok: true }` |
| Output 403 | ownership falla |
| Output 409 | `{ error: "listing_not_cancellable" }` si status != active |
| Rate limit | 20/min/user |
| Side effects | Llamar RPC `cancel_listing(p_listing_id)` que: (a) cancelea todas las ofertas pending + libera locks; (b) devuelve la carta al seller; (c) marca status='cancelled'; (d) envía notificaciones `trade_offer_rejected` a cada buyer. |

### 3.4 `GET /api/market/listings/[id]/offers`

| Propiedad | Valor |
|-----------|-------|
| Path | `src/app/api/market/listings/[id]/offers/route.ts` |
| Método | GET |
| Auth | Requiere sesión + ownership (solo seller del listing) |
| Output 200 | `{ offers: TradeOffer[] }` con join a `offered_card` + `buyer` profile |
| Rate limit | 60/min/user |

### 3.5 `POST /api/market/listings/[id]/offers`

| Propiedad | Valor |
|-----------|-------|
| Path | `src/app/api/market/listings/[id]/offers/route.ts` |
| Método | POST |
| Auth | Requiere sesión |
| Input | `{ offered_card_id: string (UUID) }` |
| Output 201 | `{ offer: TradeOffer }` — con `status='pending'` o `status='accepted'` si auto-accept |
| Output 422 | `{ error: "insufficient_points" \| "available_quantity_insufficient" \| "no_self_offer" \| "listing_not_active" \| "listing_expired" \| "duplicate_pending_offer" }` |
| Rate limit | **5/min/user** (spec F-03 obliga) |
| Validaciones | (1) listing.status='active' AND listing.expires_at > now(); (2) buyer != seller; (3) `rarity_points(offered) >= rarity_points(listed)`; (4) buyer tiene `quantity - locked_quantity >= 1` de la carta ofrecida; (5) no hay oferta pending duplicada |
| Side effects | Si `listing.auto_accept=true`: llamar RPC `execute_trade(null, offered_card_id)` variante que acepta sin offer previa — o mejor: crear el offer en status 'pending', luego llamar `execute_trade(offer_id)` en la misma request y retornar el offer ya en `accepted`. Si `auto_accept=false`: `INSERT trade_offers` + `UPDATE user_cards SET locked_quantity += 1` + `INSERT notifications (trade_offer_received)` — todo en RPC `create_offer`. |

### 3.6 `POST /api/market/listings/[id]/offers/[offerId]/accept`

| Propiedad | Valor |
|-----------|-------|
| Path | `src/app/api/market/listings/[id]/offers/[offerId]/accept/route.ts` |
| Método | POST |
| Auth | Requiere sesión + ownership (seller del listing) |
| Input | Solo params |
| Output 200 | `{ ok: true, trade_id: string }` |
| Output 422 | `{ error: "listing_not_active" \| "offer_invalid" \| "insufficient_points" }` |
| Rate limit | 20/min/user |
| Side effects | Llamar RPC `execute_trade(p_offer_id := offerId)`. La RPC maneja todo atómicamente (ver sección 7). Post-commit: insertar notificaciones `trade_offer_accepted` para el buyer ganador y `trade_offer_rejected` para cada buyer rechazado (la función SQL inserta directamente, la route solo verifica el retorno). |

### 3.7 `DELETE /api/market/listings/[id]/offers/[offerId]`

| Propiedad | Valor |
|-----------|-------|
| Path | `src/app/api/market/listings/[id]/offers/[offerId]/route.ts` |
| Método | DELETE |
| Auth | Requiere sesión + ownership (buyer de la oferta) |
| Output 200 | `{ ok: true }` |
| Output 409 | `{ error: "offer_not_cancellable" }` si status != pending |
| Rate limit | 20/min/user |
| Side effects | Llamar RPC `cancel_offer(p_offer_id)` que: (a) marca status='cancelled'; (b) libera locked_quantity del buyer. No notifica al seller (decisión UX). |

### 3.8 `GET /api/cards/inventory`

| Propiedad | Valor |
|-----------|-------|
| Path | `src/app/api/cards/inventory/route.ts` |
| Método | GET |
| Auth | Requiere sesión |
| Output 200 | `{ cards: UserCard[] }` con join a `cards` (definición) |
| Rate limit | 60/min/user |
| Query | `user_cards WHERE user_id=user.id ORDER BY cards.rarity_points DESC, cards.name ASC`. Incluye `available_quantity = quantity - locked_quantity` calculado server-side. |

Razón: aunque RLS permite lectura directa, centralizamos en una route para: (a) agregar el campo derivado `available_quantity`; (b) poder cachear en el edge si hace falta; (c) mantener un shape consistente con el resto de endpoints.

### 3.9 `GET /api/wishlist`, `POST /api/wishlist`, `DELETE /api/wishlist/[cardId]`

| Método | Path | Input | Output | Rate limit |
|--------|------|-------|--------|------------|
| GET  | `src/app/api/wishlist/route.ts` | — | `{ items: WishlistItem[] }` | 60/min/user |
| POST | `src/app/api/wishlist/route.ts` | `{ card_definition_id: UUID }` | 201 `{ item }` / 409 `already_in_wishlist` | 20/min/user |
| DELETE | `src/app/api/wishlist/[cardId]/route.ts` | param | 200 `{ ok: true }` | 20/min/user |

### 3.10 `POST /api/market/expire` (admin / fallback)

| Propiedad | Valor |
|-----------|-------|
| Path | `src/app/api/market/expire/route.ts` |
| Método | POST |
| Auth | Header `x-cron-secret: {CRON_SECRET}` (mismo patrón que `cleanup-demo`) |
| Output 200 | `{ processed: number, errors: number }` |
| Uso | pg_cron lo ignora (corre la función SQL directo). Esta route es un fallback para invocar manualmente en debugging o si pg_cron falla. |
| Implementación | `SELECT * FROM public.expire_listings()` vía admin client. |

---

## 4. Hooks React Query v5

Todos los hooks viven en nuevos archivos en `src/hooks/`. El pattern es idéntico a `usePacks.ts` y `useFriends.ts`.

| Hook | Tipo | queryKey / mutationFn | Retorna | Invalidaciones |
|------|------|------------------------|---------|----------------|
| `useInventory()` | query | `["inventory", userId]` | `UserCard[]` con `available_quantity` | — |
| `useMarketListings(filters?)` | query (infinite) | `["market", "listings", filters]` | páginas `{ listings, next_cursor }` | — |
| `useListing(id)` | query | `["market", "listing", id]` | `MarketListing` con seller + card | — |
| `useListingOffers(listingId)` | query | `["market", "listing", listingId, "offers"]` | `TradeOffer[]` | Fase 3: `refetchInterval: 15_000` hasta que Realtime esté listo. Fase 3+: suscripción realtime. |
| `useMyListings()` | query | `["market", "my-listings", userId]` | `MarketListing[]` del seller autenticado | — |
| `useCreateListing()` | mutation | POST `/api/market/listings` | `{ listing }` | invalida `["inventory"]`, `["market", "listings"]`, `["market", "my-listings"]` |
| `useCancelListing()` | mutation | DELETE `/api/market/listings/[id]` | `{ ok: true }` | invalida `["inventory"]`, `["market", "my-listings"]`, `["market", "listing", id]` |
| `useCreateOffer()` | mutation | POST `/api/market/listings/[id]/offers` | `{ offer }` | invalida `["inventory"]`, `["market", "listing", listingId, "offers"]`. Si `auto_accept` → también invalida `["market", "listings"]` y `["trade-history"]`. |
| `useAcceptOffer()` | mutation | POST accept | `{ ok, trade_id }` | invalida `["inventory"]`, `["market", "listing", id]`, `["market", "my-listings"]`, `["trade-history"]` |
| `useCancelOffer()` | mutation | DELETE offer | `{ ok }` | invalida `["inventory"]`, `["market", "listing", listingId, "offers"]`, `["my-offers"]` |
| `useMyOffers()` | query | `["my-offers", userId, status?]` | `TradeOffer[]` del buyer | — |
| `useTradeHistory()` | query | `["trade-history", userId]` | `TradeHistory[]` | — |
| `useWishlist()` | query | `["wishlist", userId]` | `WishlistItem[]` | — |
| `useToggleWishlist()` | mutation | POST/DELETE según estado | `{ ok }` | invalida `["wishlist", userId]`, optimistic update en el item |

**Organización de archivos**:
- `src/hooks/useInventory.ts` — `useInventory`
- `src/hooks/useMarket.ts` — `useMarketListings`, `useListing`, `useListingOffers`, `useMyListings`, `useCreateListing`, `useCancelListing`, `useCreateOffer`, `useAcceptOffer`, `useCancelOffer`, `useMyOffers`
- `src/hooks/useTradeHistory.ts` — `useTradeHistory`
- `src/hooks/useWishlist.ts` — `useWishlist`, `useToggleWishlist`

**Optimistic updates críticos**:
- `useCreateListing`: mutar `useInventory` inmediatamente decrementando `quantity` y `available_quantity` de la carta listada. Rollback si la mutation falla.
- `useCreateOffer`: mutar `useInventory` incrementando `locked_quantity` de la carta ofrecida. Rollback si falla.
- `useToggleWishlist`: togglear el item localmente.

---

## 5. Componentes y páginas

Árbol propuesto, consistente con la estructura `(main)` existente y con atomic design:

```
src/app/(main)/
├── market/
│   ├── page.tsx                       # mercado global
│   ├── [listingId]/
│   │   └── page.tsx                   # detalle del listing + ofertar
│   ├── my-listings/
│   │   └── page.tsx                   # mis listings activos + ofertas recibidas
│   └── history/
│       └── page.tsx                   # historial de intercambios
├── collection/
│   └── page.tsx                       # REFACTOR: usar nuevo schema stacked
└── wishlist/
    └── page.tsx                       # mi wishlist

src/components/
├── collection/
│   ├── CollectionGrid.tsx             # DndContext + grilla de cartas del user
│   ├── CardItem.tsx                   # carta individual, badge ×N, icono 🔒
│   └── CardDropZone.tsx               # zona drop genérica (mercado o wishlist)
├── market/
│   ├── MarketCard.tsx                 # carta presentacional en grid del mercado
│   ├── MarketListingView.tsx          # detalle del listing (seller view + datos)
│   ├── OfferCard.tsx                  # oferta recibida (para el vendedor)
│   ├── OfferList.tsx                  # lista de ofertas con paginación
│   ├── ListingModal.tsx               # modal al crear listing: toggle auto_accept + confirm
│   ├── OfferModal.tsx                 # modal al ofertar: seleccionar carta + validar puntos
│   ├── TradeConfirmModal.tsx          # confirmación antes de ejecutar accept
│   └── RarityPointsBadge.tsx          # badge "4 pts" / "★ legendary 16 pts"
├── wishlist/
│   ├── WishlistGrid.tsx               # grilla de cartas deseadas
│   └── WishlistHeart.tsx              # toggle corazón en cada carta
└── trade/
    └── TradeHistoryItem.tsx           # fila del historial (you gave / you got)
```

### Responsabilidades clave

| Componente | Responsabilidad |
|------------|-----------------|
| `CollectionGrid` | Envuelve la colección en `<DndContext>`. Cada `CardItem` es draggable (con `useDraggable`). Detecta `onDragEnd` y delega al handler apropiado. |
| `CardItem` | Presentacional. Muestra imagen, rareza, badge `×N`, `🔒 N` si tiene locks. Acepta `isDragging` para feedback visual. |
| `MarketCard` | En `/market/page.tsx`. Link a `/market/[listingId]`. Muestra seller, tiempo restante, auto-accept badge. |
| `OfferCard` | Usada por el seller en `my-listings`. Muestra carta ofrecida + profile del buyer + botones `Aceptar` / `Rechazar`. |
| `ListingModal` | Se abre al drop en `CardDropZone` configurado como "mercado". Pre-valida `available_quantity`. Toggle de `auto_accept`. Confirma con `useCreateListing`. |
| `OfferModal` | Se abre en `/market/[listingId]`. Lista cartas del user filtradas por `rarity_points >= listing.rarity_points` y `available_quantity >= 1`. Confirma con `useCreateOffer`. |
| `TradeConfirmModal` | Previsualización before accept: muestra "vas a dar X y recibir Y". Llama `useAcceptOffer` al confirmar. |
| `WishlistHeart` | Toggle en `MarketCard` / `CardItem` / detalle. Usa `useToggleWishlist`. |

---

## 6. Flujo de Drag & Drop con `@dnd-kit`

### 6.1 Instalación

```bash
bun add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

### 6.2 Arquitectura de DnD

```
<DndContext sensors={[MouseSensor, TouchSensor(250ms)]} collisionDetection={closestCenter}>
  <CollectionGrid>                 # fuente
    <CardItem useDraggable id={cardDefinitionId} />
    <CardItem useDraggable id={cardDefinitionId} />
    ...
  </CollectionGrid>

  <CardDropZone useDroppable id="market-drop">   # destino 1: listar
    "Arrastrá acá para listar"
  </CardDropZone>

  <CardDropZone useDroppable id="wishlist-drop">  # destino 2 (en /wishlist): agregar
    "Arrastrá acá para agregar a wishlist"
  </CardDropZone>
</DndContext>
```

En `/market/[listingId]` la semántica cambia: la drop zone representa "ofertar":

```
<CardDropZone useDroppable id="offer-drop" data={{ listingId, minPoints: listing.rarity_points }}>
  "Soltá acá para ofertar por esta carta"
</CardDropZone>
```

### 6.3 Qué es draggable y qué es droppable

| Draggable | Droppable | Acción |
|-----------|-----------|--------|
| `CardItem` del inventario | `market-drop` (en `/collection` o `/market/my-listings`) | Abre `ListingModal` |
| `CardItem` del inventario | `offer-drop` (en `/market/[listingId]`) | Abre `OfferModal` pre-cargado con la carta |
| `CardItem` del inventario | `wishlist-drop` (en `/wishlist`) | Toggle: si no está, agregar; si está, remover |

### 6.4 Lógica de `onDragEnd`

```ts
function onDragEnd(event: DragEndEvent) {
  const { active, over } = event;
  if (!over) return;

  const cardDefinitionId = active.id as string;
  const userCard = inventory.find(c => c.card_definition_id === cardDefinitionId);
  if (!userCard) return;

  // Validación universal: available_quantity >= 1
  const available = userCard.quantity - userCard.locked_quantity;
  if (available < 1) {
    toast.error("Ya tenés esa carta reservada en otro listing/oferta");
    return;
  }

  switch (over.id) {
    case "market-drop":
      setListingModal({ card: userCard, open: true });
      break;

    case "offer-drop": {
      const { listingId, minPoints } = over.data.current as OfferDropData;
      if (userCard.cards!.rarity_points < minPoints) {
        toast.error(`Esa carta tiene ${userCard.cards!.rarity_points} pts, necesitás al menos ${minPoints}`);
        return;
      }
      setOfferModal({ card: userCard, listingId, open: true });
      break;
    }

    case "wishlist-drop":
      toggleWishlist(cardDefinitionId);
      break;
  }
}
```

**Validaciones del cliente son solo UX**: el servidor **siempre** revalida. Un usuario que evade el cliente igual choca con la API.

### 6.5 Sensors para mobile

```ts
const sensors = useSensors(
  useSensor(PointerSensor, {
    activationConstraint: { distance: 8 },        // evita drag accidental en click
  }),
  useSensor(TouchSensor, {
    activationConstraint: { delay: 250, tolerance: 8 },  // delay anti-scroll
  }),
  useSensor(KeyboardSensor)                       // accesibilidad
);
```

**Delay de 250 ms en touch** es crítico: sin delay, `@dnd-kit` compite con el scroll vertical nativo en Safari iOS. Con 250 ms el user tiene que mantener el dedo antes del drag — el scroll sigue funcionando.

### 6.6 Fallback sin drag

Cada carta tiene un botón "Listar" / "Ofertar" accesible por teclado y como backup en mobiles donde el drag se sienta mal. Los botones disparan exactamente el mismo modal que el drop.

---

## 7. RPC SQL — `execute_trade(p_offer_id uuid)`

Esta es la pieza central de atomicidad. El diseño asume que el offer YA existe con status `pending` (creado por POST offers); para auto-accept, la API route inserta el offer como pending y llama a `execute_trade` en la misma request.

```sql
CREATE OR REPLACE FUNCTION public.execute_trade(p_offer_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_listing       public.market_listings;
  v_offer         public.trade_offers;
  v_listed_points smallint;
  v_offered_points smallint;
  v_rejected      RECORD;
BEGIN
  -- 1. Lock de la oferta — previene doble accept
  SELECT * INTO v_offer
  FROM public.trade_offers
  WHERE id = p_offer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'offer_not_found');
  END IF;

  IF v_offer.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'offer_invalid');
  END IF;

  -- 2. Lock del listing — previene cancel concurrente
  SELECT * INTO v_listing
  FROM public.market_listings
  WHERE id = v_offer.listing_id
  FOR UPDATE;

  IF v_listing.status <> 'active' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'listing_not_active');
  END IF;

  IF v_listing.expires_at <= now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'listing_expired');
  END IF;

  -- 3. Revalidar puntos (defense in depth; la API ya validó)
  SELECT rarity_points INTO v_listed_points  FROM public.cards WHERE id = v_listing.card_definition_id;
  SELECT rarity_points INTO v_offered_points FROM public.cards WHERE id = v_offer.offered_card_id;

  IF v_offered_points < v_listed_points THEN
    RETURN jsonb_build_object('ok', false, 'error', 'insufficient_points');
  END IF;

  -- 4. Transferir carta listada: seller -> buyer
  --    La carta ya salió del inventario del seller al crearse el listing (quantity -= 1).
  --    Solo hay que dársela al buyer.
  INSERT INTO public.user_cards (user_id, card_definition_id, quantity)
    VALUES (v_offer.buyer_id, v_listing.card_definition_id, 1)
  ON CONFLICT (user_id, card_definition_id)
    DO UPDATE SET quantity = public.user_cards.quantity + 1;

  -- 5. Transferir carta ofrecida: buyer -> seller
  --    El buyer tiene quantity>=1 y locked_quantity>=1 (locked al crear la oferta).
  UPDATE public.user_cards
    SET quantity        = quantity - 1,
        locked_quantity = locked_quantity - 1
  WHERE user_id = v_offer.buyer_id
    AND card_definition_id = v_offer.offered_card_id;

  INSERT INTO public.user_cards (user_id, card_definition_id, quantity)
    VALUES (v_listing.seller_id, v_offer.offered_card_id, 1)
  ON CONFLICT (user_id, card_definition_id)
    DO UPDATE SET quantity = public.user_cards.quantity + 1;

  -- 6. Marcar la oferta ganadora como accepted
  UPDATE public.trade_offers
    SET status = 'accepted', resolved_at = now()
  WHERE id = p_offer_id;

  -- 7. Rechazar el resto + liberar locks + notificar
  FOR v_rejected IN
    SELECT id, buyer_id, offered_card_id
    FROM public.trade_offers
    WHERE listing_id = v_offer.listing_id
      AND status = 'pending'
      AND id <> p_offer_id
    FOR UPDATE
  LOOP
    UPDATE public.user_cards
      SET locked_quantity = locked_quantity - 1
    WHERE user_id = v_rejected.buyer_id
      AND card_definition_id = v_rejected.offered_card_id;

    UPDATE public.trade_offers
      SET status = 'rejected', resolved_at = now()
    WHERE id = v_rejected.id;

    INSERT INTO public.notifications
      (notification_type, user_emisor, user_receptor, post_id, reference_id, reference_type)
    VALUES
      ('trade_offer_rejected', v_listing.seller_id, v_rejected.buyer_id, NULL, v_rejected.id, 'offer');
  END LOOP;

  -- 8. Cerrar el listing
  UPDATE public.market_listings
    SET status = 'completed', completed_at = now()
  WHERE id = v_listing.id;

  -- 9. Insertar en history
  INSERT INTO public.trade_history
    (listing_id, seller_id, buyer_id, listed_card_id, offered_card_id)
  VALUES
    (v_listing.id, v_listing.seller_id, v_offer.buyer_id,
     v_listing.card_definition_id, v_offer.offered_card_id);

  -- 10. Notificación al buyer ganador
  INSERT INTO public.notifications
    (notification_type, user_emisor, user_receptor, post_id, reference_id, reference_type)
  VALUES
    ('trade_offer_accepted', v_listing.seller_id, v_offer.buyer_id, NULL, p_offer_id, 'offer');

  RETURN jsonb_build_object(
    'ok', true,
    'trade_id', v_listing.id,
    'offer_id', p_offer_id
  );
END;
$$;

-- Permisos: solo el service_role la invoca desde las routes
REVOKE ALL ON FUNCTION public.execute_trade(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.execute_trade(uuid) TO service_role;
```

### 7.1 Propiedades clave del RPC

1. **Atomicidad**: todo dentro de una única transacción implícita de PL/pgSQL. Si cualquier paso falla (constraint violation, timeout), Postgres hace rollback completo.
2. **Race-safety**: `FOR UPDATE` en offer y listing serializa cualquier intento concurrente. Un segundo `execute_trade` con el mismo offer espera al primer commit y luego ve `status='accepted'` → retorna `offer_invalid`.
3. **Re-validación**: puntos se recalculan aún después del lock. Cubre el caso (muy improbable) de que alguien haya editado `cards.rarity_points` entre la validación de la API y el commit.
4. **Cascada determinística**: las ofertas rechazadas se procesan en un loop con `FOR UPDATE` sobre cada una, garantizando que nadie edite en paralelo.
5. **Notificaciones inline**: se insertan en la misma transacción. Si el trade hace commit, las notifs también. Si rollback, tampoco hay notifs huérfanas.
6. **Devolución de resultado**: `jsonb` con `ok` + `error` textual. La API route mapea el error a HTTP 422 + payload.

### 7.2 Helpers RPC relacionados

```sql
-- Crear listing atómicamente (decrementa user_cards + inserta listing)
CREATE OR REPLACE FUNCTION public.create_listing(
  p_seller_id uuid,
  p_card_id uuid,
  p_auto_accept boolean
) RETURNS jsonb ...
-- body: SELECT ... FOR UPDATE en user_cards, valida available, decrementa, inserta listing.
-- Si duplicate_active_listing → ON CONFLICT DO NOTHING + retorno error.

-- Cancelar listing (cascade a ofertas)
CREATE OR REPLACE FUNCTION public.cancel_listing(p_listing_id uuid, p_user_id uuid) RETURNS jsonb ...
-- Valida ownership, status='active', cancela ofertas, libera locks, devuelve carta.

-- Crear oferta (lockea carta + inserta trade_offer + notif)
CREATE OR REPLACE FUNCTION public.create_offer(
  p_listing_id uuid, p_buyer_id uuid, p_offered_card_id uuid
) RETURNS jsonb ...
-- Valida todo, lockea, inserta. Si listing.auto_accept → llama execute_trade en cascada.

-- Cancelar oferta propia
CREATE OR REPLACE FUNCTION public.cancel_offer(p_offer_id uuid, p_user_id uuid) RETURNS jsonb ...
```

**Decisión**: encapsular todas las operaciones mutantes en RPCs, no en código Node. Ventaja: atomicidad garantizada + menos round-trips + lógica reutilizable. Desventaja: debugging SQL es más pesado — mitigado con tests de integración que llaman las RPCs directamente.

---

## 8. Manejo de notificaciones

Las notificaciones se insertan desde:

| Evento | Quién inserta | Cuándo |
|--------|---------------|--------|
| `trade_offer_received` | RPC `create_offer` (solo si listing NO es auto_accept) | al crear oferta |
| `trade_offer_accepted` | RPC `execute_trade` | al ejecutar trade (manual o auto) |
| `trade_offer_rejected` | RPC `execute_trade` (cascade) + RPC `cancel_listing` | al aceptar otra oferta / cancelar listing |
| `wishlist_card_listed` | RPC `create_listing` | al listar, consultando `wishlists` |
| `listing_expired` | Función `expire_listings` (pg_cron) | cada hora |
| `trade_match_suggested` | Fase 5.5 (out of scope) | — |

**Cooldown de wishlist (24h)**: se implementa en RPC `create_listing`:

```sql
INSERT INTO public.notifications (notification_type, user_emisor, user_receptor, reference_id, reference_type)
SELECT 'wishlist_card_listed', p_seller_id, w.user_id, v_new_listing_id, 'listing'
FROM public.wishlists w
WHERE w.card_definition_id = p_card_id
  AND w.user_id <> p_seller_id               -- no notificar al propio seller
  AND NOT EXISTS (
    SELECT 1 FROM public.notifications n
    WHERE n.user_receptor = w.user_id
      AND n.notification_type = 'wishlist_card_listed'
      AND n.reference_id IN (
        SELECT id FROM public.market_listings ml WHERE ml.card_definition_id = p_card_id
      )
      AND n.created_at > now() - interval '24 hours'
  );
```

---

## 9. Testing plan (Strict TDD)

Antes de implementar cualquier módulo, escribir tests. Cobertura mínima:

### 9.1 Tests de DB (SQL, ejecutables via vitest + pg-mem o script Supabase)

- `execute_trade` acepta oferta válida y transfiere correctamente.
- `execute_trade` rechaza si offer ya no pending.
- `execute_trade` rechaza si listing no active.
- `execute_trade` rechaza cascade todas las otras ofertas.
- `create_listing` rechaza duplicado activo (unique constraint).
- `create_offer` lockea correctamente.
- `expire_listings` es idempotente.

### 9.2 Tests de API routes (vitest, server-side)

Patrón: mock de `@/lib/supabase/server`, llamar al handler directamente con `NextRequest` mock.

- 401 sin sesión.
- 429 sobre rate limit.
- 400 por input inválido.
- 422 por regla de negocio (`insufficient_points`, `no_self_offer`, etc.).
- 201 / 200 en happy path + verificar el body.

### 9.3 Tests de hooks (vitest + @testing-library/react)

- `useCreateListing`: optimistic update decrementa inventory, rollback en error.
- `useCreateOffer`: invalidaciones correctas post-success.
- `useToggleWishlist`: toggle correcto.

### 9.4 Tests de componentes (@testing-library/react)

- `ListingModal` se abre con los datos correctos al drop.
- `OfferModal` filtra cartas por `rarity_points >= minPoints`.
- `CollectionGrid` responde a DndContext events.

---

## 10. Orden de implementación recomendado

1. **Migration SQL**: aplicar DDL completo + migrar datos + crear RPCs + instalar pg_cron job. Tests SQL pasando.
2. **Tipos** en `src/types/index.ts`. `bunx tsc --noEmit` limpio.
3. **API routes del mercado** (listings GET/POST/DELETE + offers CRUD + inventory). Tests passing.
4. **Hooks** (`useInventory`, `useMarket`). Tests passing.
5. **Colección refactor** (`CollectionGrid`, `CardItem`) con nuevo schema.
6. **Mercado UI** (`/market` + `/market/[id]`). DnD funcional.
7. **My listings** + flujo de accept/reject.
8. **Wishlist** completo (tabla + API + UI + notif de `wishlist_card_listed`).
9. **Historial** (`/market/history`).
10. **QA + ajustes de UX mobile**.

Cada paso cierra con: tests verdes + `bunx tsc --noEmit` + demo funcional manual.

---

## 11. Riesgos residuales

| Riesgo | Mitigación |
|--------|-----------|
| pg_cron no habilitado en el proyecto Supabase | Verificar en dashboard Supabase: Database → Extensions → `pg_cron`. Si no, activarlo antes de deploy. Si falla, fallback a `/api/market/expire` + Vercel Cron 1/día (peor UX pero funcional). |
| Deadlock en `execute_trade` con muchas ofertas simultáneas | `FOR UPDATE SKIP LOCKED` en el loop de rechazo mitiga. Monitor con `pg_stat_activity` en prod. |
| Rate limit in-memory no escala a múltiples instancias Vercel | Ya documentado en `src/lib/rate-limit.ts`. Migrar a Upstash Redis cuando haga falta. Por ahora OK porque Vercel free plan = 1 instancia. |
| @dnd-kit rompe con el scroll en iOS Safari | Mitigado con `TouchSensor({ delay: 250, tolerance: 8 })`. Validar en device real en QA. |
| `locked_quantity` se desincroniza por bug en un RPC | Query de reconciliación diaria (ver proposal §4.4). Monitoreo con alerta si detecta > 0 registros inconsistentes. |
| Notificaciones inundan al seller con ofertas spam | Rate limit 5/min/buyer en POST offers mitiga. UI agrupa ("3 ofertas nuevas"). |
| Realtime en `trade_offers` no está habilitado al llegar a Fase 3 | Fallback a `refetchInterval: 15_000` en `useListingOffers` — ya planeado. |

---

## 12. Archivos afectados (resumen)

### Nuevos

- `supabase/migrations/20260424_trading_system.sql` (DDL + RPCs + pg_cron)
- `src/app/api/cards/inventory/route.ts`
- `src/app/api/market/listings/route.ts`
- `src/app/api/market/listings/[id]/route.ts`
- `src/app/api/market/listings/[id]/offers/route.ts`
- `src/app/api/market/listings/[id]/offers/[offerId]/route.ts`
- `src/app/api/market/listings/[id]/offers/[offerId]/accept/route.ts`
- `src/app/api/market/expire/route.ts`
- `src/app/api/wishlist/route.ts`
- `src/app/api/wishlist/[cardId]/route.ts`
- `src/hooks/useInventory.ts`
- `src/hooks/useMarket.ts`
- `src/hooks/useTradeHistory.ts`
- `src/hooks/useWishlist.ts`
- `src/app/(main)/market/page.tsx`
- `src/app/(main)/market/[listingId]/page.tsx`
- `src/app/(main)/market/my-listings/page.tsx`
- `src/app/(main)/market/history/page.tsx`
- `src/app/(main)/wishlist/page.tsx`
- `src/components/collection/{CollectionGrid,CardItem,CardDropZone}.tsx`
- `src/components/market/{MarketCard,MarketListingView,OfferCard,OfferList,ListingModal,OfferModal,TradeConfirmModal,RarityPointsBadge}.tsx`
- `src/components/wishlist/{WishlistGrid,WishlistHeart}.tsx`
- `src/components/trade/TradeHistoryItem.tsx`
- Tests en `__tests__/` correspondientes a cada archivo nuevo

### Modificados

- `src/types/index.ts` (tipos trading + extensión `NotificationType` + `Notification`)
- `src/hooks/usePacks.ts` (refactor `useCollection` → `useInventory` o bridge interno al nuevo schema)
- `src/app/(main)/collection/page.tsx` (usar `useInventory` + `CollectionGrid`)
- `package.json` (agregar `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`)

### Deprecated / removed

- Columna `user_cards.for_trade` (no existe post-migración, reemplazada por `market_listings`)
- Columna `user_cards.obtained_at` → reemplazada por `first_obtained_at`
- Columna `user_cards.id` → la PK ahora es compuesta `(user_id, card_definition_id)`

---

## 13. Próxima fase

`sdd-tasks` — desglose de la implementación en tareas checkeables siguiendo el orden de §10.
