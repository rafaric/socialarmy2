-- =============================================================================
-- Trading System — Migración completa
-- Fecha: 2026-04-24
-- Change: trading-system
-- Ejecutar como una transacción única. Si cualquier paso falla, rollback total.
-- =============================================================================

BEGIN;

-- =============================================================================
-- §1.1 — Agregar rarity_points a tabla cards
-- =============================================================================

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

-- Trigger: mantiene rarity_points sincronizado si se inserta/actualiza rarity
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

-- =============================================================================
-- §1.2 — Migración directa de user_cards al modelo stacked
-- Schema anterior: (id, user_id, card_id, for_trade, obtained_at) — una fila por instancia
-- Schema nuevo:    (user_id, card_definition_id, quantity, locked_quantity, ...) — stacked
-- =============================================================================

-- Paso 1: snapshot de datos actuales
CREATE TABLE IF NOT EXISTS public._user_cards_snapshot AS
  SELECT user_id, card_id, COUNT(*)::smallint AS quantity, MIN(obtained_at) AS first_obtained_at
  FROM public.user_cards
  GROUP BY user_id, card_id;

-- Paso 2: drop de la tabla vieja (migración directa — no hay usuarios activos)
DROP TABLE IF EXISTS public.user_cards CASCADE;

-- Paso 3: recrear user_cards con el nuevo schema
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

CREATE INDEX idx_user_cards_user           ON public.user_cards(user_id);
CREATE INDEX idx_user_cards_card           ON public.user_cards(card_definition_id);
CREATE INDEX idx_user_cards_user_available ON public.user_cards(user_id)
  WHERE quantity > locked_quantity;

-- Paso 4: restaurar datos desde el snapshot
INSERT INTO public.user_cards (user_id, card_definition_id, quantity, locked_quantity, first_obtained_at)
SELECT user_id, card_id, quantity, 0, first_obtained_at
FROM public._user_cards_snapshot;

-- Paso 5: validación dura — si los sums difieren, rollback
DO $$
DECLARE
  v_new_sum  integer;
  v_snap_sum integer;
BEGIN
  SELECT COALESCE(SUM(quantity), 0) INTO v_new_sum  FROM public.user_cards;
  SELECT COALESCE(SUM(quantity), 0) INTO v_snap_sum FROM public._user_cards_snapshot;
  IF v_new_sum <> v_snap_sum THEN
    RAISE EXCEPTION 'Migración inconsistente: new_sum=% snap_sum=%', v_new_sum, v_snap_sum;
  END IF;
END $$;

-- Paso 6: trigger updated_at
CREATE OR REPLACE FUNCTION public.touch_user_cards_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_touch_user_cards_updated_at ON public.user_cards;
CREATE TRIGGER trg_touch_user_cards_updated_at
BEFORE UPDATE ON public.user_cards
FOR EACH ROW EXECUTE FUNCTION public.touch_user_cards_updated_at();

-- Nota: _user_cards_snapshot se mantiene 1 sprint para auditoría manual.
-- Para limpiarla: DROP TABLE public._user_cards_snapshot;

-- =============================================================================
-- §1.3 — market_listings
-- =============================================================================

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

-- Un seller NO puede tener dos listings activos para la misma carta
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

-- =============================================================================
-- §1.4 — trade_offers
-- =============================================================================

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

-- Un buyer NO puede tener dos ofertas activas con la misma carta en el mismo listing
CREATE UNIQUE INDEX uniq_pending_offer_per_buyer_card_listing
  ON public.trade_offers(listing_id, buyer_id, offered_card_id)
  WHERE status = 'pending';

CREATE INDEX idx_trade_offers_listing_pending
  ON public.trade_offers(listing_id)
  WHERE status = 'pending';

CREATE INDEX idx_trade_offers_buyer
  ON public.trade_offers(buyer_id, status, created_at DESC);

-- =============================================================================
-- §1.5 — trade_history (inmutable)
-- =============================================================================

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

-- =============================================================================
-- §1.6 — wishlists
-- =============================================================================

CREATE TABLE public.wishlists (
  user_id             uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  card_definition_id  uuid        NOT NULL REFERENCES public.cards(id)    ON DELETE CASCADE,
  created_at          timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, card_definition_id)
);

CREATE INDEX idx_wishlists_card ON public.wishlists(card_definition_id);

-- =============================================================================
-- §1.7 — RLS — Row Level Security
-- Escrituras en user_cards/market_listings/trade_offers/trade_history van
-- EXCLUSIVAMENTE por API routes con admin client (service_role). Por eso no
-- hay policies INSERT/UPDATE/DELETE en esas tablas.
-- =============================================================================

-- user_cards
ALTER TABLE public.user_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own cards"
  ON public.user_cards FOR SELECT
  USING (auth.uid() = user_id);

-- market_listings (mercado global — todo el mundo lee lo activo)
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

-- wishlists (client-side directo — sí tiene INSERT/DELETE)
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

-- =============================================================================
-- §1.8 — Extensión de notifications con reference_id y reference_type
-- No requiere ALTER del tipo — los nuevos strings son válidos sin constraint.
-- =============================================================================

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS reference_id   uuid,
  ADD COLUMN IF NOT EXISTS reference_type text;

COMMENT ON COLUMN public.notifications.reference_id
  IS 'Para trading: listing_id o offer_id según reference_type. Null en notifs legacy.';

COMMENT ON COLUMN public.notifications.reference_type
  IS 'listing | offer | null';

-- =============================================================================
-- §1.9 — RPCs SQL
-- Todas usan SECURITY DEFINER para operar sin RLS desde el service_role.
-- Permisos: REVOKE ALL FROM PUBLIC + GRANT TO service_role.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- RPC: execute_trade(p_offer_id uuid)
-- Pieza central de atomicidad. Acepta una oferta y transfiere cartas.
-- Lock order: offer PRIMERO, luego listing (previene deadlocks).
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.execute_trade(p_offer_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_listing        public.market_listings;
  v_offer          public.trade_offers;
  v_listed_points  smallint;
  v_offered_points smallint;
  v_rejected       RECORD;
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

  -- 3. Revalidar puntos (defense in depth)
  SELECT rarity_points INTO v_listed_points  FROM public.cards WHERE id = v_listing.card_definition_id;
  SELECT rarity_points INTO v_offered_points FROM public.cards WHERE id = v_offer.offered_card_id;

  IF v_offered_points < v_listed_points THEN
    RETURN jsonb_build_object('ok', false, 'error', 'insufficient_points');
  END IF;

  -- 4. Transferir carta listada: -> buyer
  --    La carta ya salió del inventario del seller al crearse el listing (quantity -= 1).
  INSERT INTO public.user_cards (user_id, card_definition_id, quantity)
    VALUES (v_offer.buyer_id, v_listing.card_definition_id, 1)
  ON CONFLICT (user_id, card_definition_id)
    DO UPDATE SET quantity = public.user_cards.quantity + 1;

  -- 5. Transferir carta ofrecida: buyer -> seller
  UPDATE public.user_cards
    SET quantity        = quantity - 1,
        locked_quantity = locked_quantity - 1
  WHERE user_id            = v_offer.buyer_id
    AND card_definition_id = v_offer.offered_card_id;

  INSERT INTO public.user_cards (user_id, card_definition_id, quantity)
    VALUES (v_listing.seller_id, v_offer.offered_card_id, 1)
  ON CONFLICT (user_id, card_definition_id)
    DO UPDATE SET quantity = public.user_cards.quantity + 1;

  -- 6. Marcar la oferta ganadora como accepted
  UPDATE public.trade_offers
    SET status = 'accepted', resolved_at = now()
  WHERE id = p_offer_id;

  -- 7. Rechazar el resto de ofertas pending + liberar locks + notificar
  FOR v_rejected IN
    SELECT id, buyer_id, offered_card_id
    FROM public.trade_offers
    WHERE listing_id = v_offer.listing_id
      AND status     = 'pending'
      AND id         <> p_offer_id
    FOR UPDATE
  LOOP
    UPDATE public.user_cards
      SET locked_quantity = locked_quantity - 1
    WHERE user_id            = v_rejected.buyer_id
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
    'ok',       true,
    'trade_id', v_listing.id,
    'offer_id', p_offer_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.execute_trade(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.execute_trade(uuid) TO service_role;

-- -----------------------------------------------------------------------------
-- RPC: create_listing(p_seller_id, p_card_id, p_auto_accept)
-- Decrementa user_cards + inserta listing atómicamente.
-- Notifica wishlist con cooldown de 24h.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_listing(
  p_seller_id   uuid,
  p_card_id     uuid,
  p_auto_accept boolean
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uc          public.user_cards;
  v_new_listing public.market_listings;
BEGIN
  -- Lock del inventario del seller para esta carta
  SELECT * INTO v_uc
  FROM public.user_cards
  WHERE user_id = p_seller_id AND card_definition_id = p_card_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'card_not_owned');
  END IF;

  -- Verificar disponibilidad (quantity - locked_quantity >= 1)
  IF (v_uc.quantity - v_uc.locked_quantity) < 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'available_quantity_insufficient');
  END IF;

  -- Decrementar quantity (la carta sale del inventario al ser listada)
  UPDATE public.user_cards
    SET quantity = quantity - 1
  WHERE user_id = p_seller_id AND card_definition_id = p_card_id;

  -- Insertar listing
  INSERT INTO public.market_listings (seller_id, card_definition_id, auto_accept)
    VALUES (p_seller_id, p_card_id, p_auto_accept)
  RETURNING * INTO v_new_listing;

  -- Notificar a usuarios que tienen esta carta en su wishlist (cooldown 24h)
  INSERT INTO public.notifications
    (notification_type, user_emisor, user_receptor, post_id, reference_id, reference_type)
  SELECT
    'wishlist_card_listed', p_seller_id, w.user_id, NULL, v_new_listing.id, 'listing'
  FROM public.wishlists w
  WHERE w.card_definition_id = p_card_id
    AND w.user_id <> p_seller_id
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_receptor      = w.user_id
        AND n.notification_type  = 'wishlist_card_listed'
        AND n.reference_id IN (
          SELECT id FROM public.market_listings ml
          WHERE ml.card_definition_id = p_card_id
        )
        AND n.created_at > now() - interval '24 hours'
    );

  RETURN jsonb_build_object(
    'ok',      true,
    'listing', row_to_json(v_new_listing)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_listing(uuid, uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_listing(uuid, uuid, boolean) TO service_role;

-- -----------------------------------------------------------------------------
-- RPC: cancel_listing(p_listing_id, p_user_id)
-- Cancela todas las ofertas pending, libera locks, devuelve carta al seller.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.cancel_listing(
  p_listing_id uuid,
  p_user_id    uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_listing public.market_listings;
  v_offer   RECORD;
BEGIN
  -- Lock del listing
  SELECT * INTO v_listing
  FROM public.market_listings
  WHERE id = p_listing_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'listing_not_found');
  END IF;

  -- Verificar ownership
  IF v_listing.seller_id <> p_user_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  -- Verificar que sea cancellable
  IF v_listing.status <> 'active' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'listing_not_cancellable');
  END IF;

  -- Cancelar todas las ofertas pending + liberar locks + notificar buyers
  FOR v_offer IN
    SELECT id, buyer_id, offered_card_id
    FROM public.trade_offers
    WHERE listing_id = p_listing_id AND status = 'pending'
    FOR UPDATE
  LOOP
    UPDATE public.user_cards
      SET locked_quantity = locked_quantity - 1
    WHERE user_id            = v_offer.buyer_id
      AND card_definition_id = v_offer.offered_card_id;

    UPDATE public.trade_offers
      SET status = 'cancelled', resolved_at = now()
    WHERE id = v_offer.id;

    INSERT INTO public.notifications
      (notification_type, user_emisor, user_receptor, post_id, reference_id, reference_type)
    VALUES
      ('trade_offer_rejected', v_listing.seller_id, v_offer.buyer_id, NULL, v_offer.id, 'offer');
  END LOOP;

  -- Devolver la carta al seller
  INSERT INTO public.user_cards (user_id, card_definition_id, quantity)
    VALUES (v_listing.seller_id, v_listing.card_definition_id, 1)
  ON CONFLICT (user_id, card_definition_id)
    DO UPDATE SET quantity = public.user_cards.quantity + 1;

  -- Marcar listing como cancelled
  UPDATE public.market_listings
    SET status = 'cancelled', completed_at = now()
  WHERE id = p_listing_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_listing(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_listing(uuid, uuid) TO service_role;

-- -----------------------------------------------------------------------------
-- RPC: create_offer(p_listing_id, p_buyer_id, p_offered_card_id)
-- Valida puntos, disponibilidad, duplicados. Lockea carta. Inserta oferta.
-- Si listing.auto_accept, llama execute_trade en cascada.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_offer(
  p_listing_id      uuid,
  p_buyer_id        uuid,
  p_offered_card_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_listing        public.market_listings;
  v_uc             public.user_cards;
  v_listed_points  smallint;
  v_offered_points smallint;
  v_new_offer      public.trade_offers;
  v_trade_result   jsonb;
BEGIN
  -- Lock del listing
  SELECT * INTO v_listing
  FROM public.market_listings
  WHERE id = p_listing_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'listing_not_found');
  END IF;

  IF v_listing.status <> 'active' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'listing_not_active');
  END IF;

  IF v_listing.expires_at <= now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'listing_expired');
  END IF;

  -- Validar que no sea self-offer
  IF v_listing.seller_id = p_buyer_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_self_offer');
  END IF;

  -- Obtener puntos
  SELECT rarity_points INTO v_listed_points  FROM public.cards WHERE id = v_listing.card_definition_id;
  SELECT rarity_points INTO v_offered_points FROM public.cards WHERE id = p_offered_card_id;

  IF v_offered_points < v_listed_points THEN
    RETURN jsonb_build_object('ok', false, 'error', 'insufficient_points');
  END IF;

  -- Lock del inventario del buyer para esta carta
  SELECT * INTO v_uc
  FROM public.user_cards
  WHERE user_id = p_buyer_id AND card_definition_id = p_offered_card_id
  FOR UPDATE;

  IF NOT FOUND OR (v_uc.quantity - v_uc.locked_quantity) < 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'available_quantity_insufficient');
  END IF;

  -- Lockear la carta del buyer (locked_quantity += 1)
  UPDATE public.user_cards
    SET locked_quantity = locked_quantity + 1
  WHERE user_id = p_buyer_id AND card_definition_id = p_offered_card_id;

  -- Insertar la oferta
  INSERT INTO public.trade_offers (listing_id, buyer_id, offered_card_id)
    VALUES (p_listing_id, p_buyer_id, p_offered_card_id)
  RETURNING * INTO v_new_offer;

  -- Si auto_accept, ejecutar trade inmediatamente
  IF v_listing.auto_accept THEN
    v_trade_result := public.execute_trade(v_new_offer.id);
    IF NOT (v_trade_result->>'ok')::boolean THEN
      -- execute_trade falló (inesperado en auto_accept) — hacer rollback del lock
      RAISE EXCEPTION 'auto_accept trade failed: %', v_trade_result->>'error';
    END IF;
    RETURN jsonb_build_object(
      'ok',          true,
      'auto_accepted', true,
      'offer_id',    v_new_offer.id,
      'trade_id',    v_trade_result->>'trade_id'
    );
  END IF;

  -- Notificar al seller que recibió una oferta
  INSERT INTO public.notifications
    (notification_type, user_emisor, user_receptor, post_id, reference_id, reference_type)
  VALUES
    ('trade_offer_received', p_buyer_id, v_listing.seller_id, NULL, v_new_offer.id, 'offer');

  RETURN jsonb_build_object(
    'ok',      true,
    'offer_id', v_new_offer.id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_offer(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_offer(uuid, uuid, uuid) TO service_role;

-- -----------------------------------------------------------------------------
-- RPC: cancel_offer(p_offer_id, p_user_id)
-- Valida ownership + status pending. Libera locked_quantity. Marca cancelled.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.cancel_offer(
  p_offer_id uuid,
  p_user_id  uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offer public.trade_offers;
BEGIN
  -- Lock de la oferta
  SELECT * INTO v_offer
  FROM public.trade_offers
  WHERE id = p_offer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'offer_not_found');
  END IF;

  -- Verificar ownership
  IF v_offer.buyer_id <> p_user_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  -- Verificar que sea cancellable
  IF v_offer.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'offer_not_cancellable');
  END IF;

  -- Liberar locked_quantity del buyer
  UPDATE public.user_cards
    SET locked_quantity = locked_quantity - 1
  WHERE user_id            = v_offer.buyer_id
    AND card_definition_id = v_offer.offered_card_id;

  -- Marcar oferta como cancelled
  UPDATE public.trade_offers
    SET status = 'cancelled', resolved_at = now()
  WHERE id = p_offer_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_offer(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_offer(uuid, uuid) TO service_role;

-- =============================================================================
-- §1.10 — expire_listings() + pg_cron (comentado — activar manualmente)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.expire_listings()
RETURNS TABLE (processed integer, errors integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_listing   RECORD;
  v_processed integer := 0;
  v_errors    integer := 0;
BEGIN
  FOR v_listing IN
    SELECT id, seller_id, card_definition_id
    FROM public.market_listings
    WHERE status = 'active' AND expires_at <= now()
    ORDER BY expires_at ASC
    LIMIT 500   -- batch por tick; el cron corre cada hora
    FOR UPDATE SKIP LOCKED
  LOOP
    BEGIN
      -- 1. Liberar locks de todas las ofertas pending + cancelarlas
      UPDATE public.user_cards uc
        SET locked_quantity = locked_quantity - 1
      FROM public.trade_offers o
      WHERE o.listing_id          = v_listing.id
        AND o.status              = 'pending'
        AND uc.user_id            = o.buyer_id
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

      -- 4. Notificación listing_expired al seller
      INSERT INTO public.notifications
        (notification_type, user_emisor, user_receptor, post_id)
      VALUES
        ('listing_expired', NULL, v_listing.seller_id, NULL);

      v_processed := v_processed + 1;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
      RAISE WARNING 'expire_listings error on listing %: %', v_listing.id, SQLERRM;
    END;
  END LOOP;

  RETURN QUERY SELECT v_processed, v_errors;
END;
$$;

-- PASO MANUAL POST-MIGRATION: ejecutar en Supabase SQL Editor una vez que pg_cron esté habilitado:
-- SELECT cron.schedule('trading-expire-listings-hourly', '0 * * * *', $$SELECT expire_listings()$$);

COMMIT;
