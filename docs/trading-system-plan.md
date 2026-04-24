# Sistema de Intercambio de Coleccionables — Plan

## Visión General

Un mercado peer-to-peer donde los usuarios listan fotocards de su colección para intercambio. El intercambio se basa en un sistema de puntos por rareza, no en dinero. Solo se pueden intercambiar cartas que estén explícitamente listadas en el mercado. El mercado es global.

---

## Rareza y Sistema de Puntos

| Rareza      | Puntos |
|-------------|--------|
| Legendaria  | 16     |
| Épica       | 8      |
| Rara        | 4      |
| Poco común  | 2      |
| Común       | 1      |

Una oferta es válida cuando los puntos de la carta ofrecida **≥ puntos de la carta listada**. Se ofrece **una sola carta por vez** (sin ofertas mixtas). El excedente no se devuelve — es el "costo de conveniencia" del comprador.

---

## Modo de Intercambio: Indirecto con opción de aceptación automática

Un único flujo de intercambio con dos comportamientos configurables por el vendedor al momento de listar:

- **Manual** (default): el vendedor revisa todas las ofertas recibidas y elige la que más le conviene.
- **Automático**: se acepta la primera oferta válida que llegue.

---

## Flujo de una transacción

### Listado
1. Usuario arrastra una fotocard de su colección al mercado (drag & drop).
2. Configura: modo de aceptación (manual/automático).
3. La carta se descuenta del badge de cantidad en su colección (`quantity` decrementado).

### Oferta
1. Usuario comprador navega el mercado y selecciona una carta listada.
2. Selecciona **una carta** de su colección para ofrecer (drag & drop).
3. El sistema valida que `rarity_points(ofrecida) ≥ rarity_points(listada)`.
4. Si es válida, la oferta queda en estado `pending` y la carta ofrecida se **lockea** (`locked_quantity` incrementado en `user_cards`).

### Aceptación
- **Modo automático**: al recibir la primera oferta válida, el sistema ejecuta el intercambio atómicamente.
- **Modo manual**: el vendedor ve todas las ofertas `pending` y elige una. Al aceptar, el sistema ejecuta el intercambio y rechaza automáticamente las demás (liberando sus locks).

### Intercambio atómico (transacción SQL)
1. Decrementar `quantity` del vendedor para la carta listada.
2. Incrementar `quantity` del comprador para la carta listada.
3. Decrementar `quantity` + `locked_quantity` del comprador para la carta ofrecida.
4. Incrementar `quantity` del vendedor para la carta ofrecida.
5. Marcar listing como `completed`.
6. Marcar oferta aceptada como `accepted`, resto como `rejected` (decrementar `locked_quantity`).
7. Insertar registro en `trade_history`.

---

## Colección y Visualización

### Modelo de inventario
Las fotocards se rastrean por cantidad, no por instancias individuales. La tabla `user_cards` tiene clave compuesta `(user_id, card_definition_id)`:

```
user_cards(user_id, card_definition_id, quantity, locked_quantity)
```

- `quantity`: total en poder del usuario (incluye locked).
- `locked_quantity`: cartas comprometidas en ofertas pendientes.
- Disponibles = `quantity - locked_quantity`.

### Stacking de duplicadas
Las fotocards repetidas se muestran como una sola carta con un badge que indica la cantidad disponible (ej: `×3`). Si `locked_quantity > 0`, se puede mostrar un indicador adicional (ej: `×1 🔒`).

---

## Drag & Drop

Implementado con `@dnd-kit` (soporta mouse y touch con una API unificada vía PointerEvents).

```ts
const sensors = useSensors(
  useSensor(MouseSensor),
  useSensor(TouchSensor, {
    activationConstraint: { delay: 250, tolerance: 5 },
  })
);
```

El delay de 250ms en touch previene conflictos con el scroll natural en mobile.

### Zonas de drop
- **Colección → Mercado**: lista la carta (abre modal de configuración).
- **Colección → Oferta activa**: selecciona la carta para ofrecer en un intercambio.

---

## Lista de Deseos (Wishlist)

Cada usuario puede marcar fotocards que desea conseguir. El sistema usa esta información para:
- Notificar al usuario cuando una carta de su wishlist aparece en el mercado.
- En el mercado, mostrar un indicador "la querés" en las cartas de tu lista.
- Sugerir matches: "Tenés una carta que X usuario desea — tiene cartas que vos querés".

---

## Historial de Intercambios

Registro inmutable de cada intercambio completado:
- Quién ofreció qué, a quién, cuándo.
- Visible en el perfil del usuario (pestaña de historial).

---

## Expiración de Listings

Las cartas en el mercado expiran a los **30 días** si no reciben intercambio. Al expirar:
- La carta vuelve automáticamente al inventario (quantity no cambia, solo se cancela el listing).
- El usuario recibe una notificación.
- Previene el mercado fantasma de usuarios inactivos.

---

## Notificaciones

| Evento                              | Receptor   |
|-------------------------------------|------------|
| Nueva oferta recibida               | Vendedor   |
| Oferta aceptada                     | Comprador  |
| Oferta rechazada (por otra elegida) | Comprador  |
| Carta de wishlist disponible        | Comprador  |
| Listing expirado                    | Vendedor   |
| Match sugerido encontrado           | Ambos      |

---

## Stack Técnico

| Capa            | Tecnología                                      |
|-----------------|-------------------------------------------------|
| UI colección    | `@dnd-kit/core` + `@dnd-kit/sortable`           |
| Estado cliente  | Zustand v5 + React Query v5                     |
| API             | Next.js App Router API routes + admin client    |
| Base de datos   | Supabase PostgreSQL con transacciones atómicas  |
| Tiempo real     | Supabase Realtime (ofertas nuevas en vivo)      |
| Notificaciones  | Sistema de notificaciones existente en la app   |

---

## Tablas de Base de Datos

```sql
-- Definición de cada fotocard (compartida entre usuarios)
card_definitions (
  id uuid PRIMARY KEY,
  name text,
  member text,
  era text,
  rarity text,           -- 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'
  rarity_points smallint, -- 1 | 2 | 4 | 8 | 16
  image_url text,
  created_at timestamptz
)

-- Inventario del usuario (cantidad por definición)
user_cards (
  user_id uuid REFERENCES profiles(id),
  card_definition_id uuid REFERENCES card_definitions(id),
  quantity smallint DEFAULT 0,
  locked_quantity smallint DEFAULT 0,
  PRIMARY KEY (user_id, card_definition_id)
)

-- Listings en el mercado
market_listings (
  id uuid PRIMARY KEY,
  seller_id uuid REFERENCES profiles(id),
  card_definition_id uuid REFERENCES card_definitions(id),
  auto_accept boolean DEFAULT false,
  status text DEFAULT 'active', -- 'active' | 'completed' | 'expired' | 'cancelled'
  expires_at timestamptz,
  created_at timestamptz
)

-- Ofertas recibidas por un listing (una carta por oferta)
trade_offers (
  id uuid PRIMARY KEY,
  listing_id uuid REFERENCES market_listings(id),
  buyer_id uuid REFERENCES profiles(id),
  offered_card_id uuid REFERENCES card_definitions(id),
  status text DEFAULT 'pending', -- 'pending' | 'accepted' | 'rejected'
  created_at timestamptz
)

-- Historial inmutable
trade_history (
  id uuid PRIMARY KEY,
  listing_id uuid REFERENCES market_listings(id),
  seller_id uuid REFERENCES profiles(id),
  buyer_id uuid REFERENCES profiles(id),
  listed_card_id uuid REFERENCES card_definitions(id),
  offered_card_id uuid REFERENCES card_definitions(id),
  completed_at timestamptz
)

-- Lista de deseos
wishlists (
  user_id uuid REFERENCES profiles(id),
  card_definition_id uuid REFERENCES card_definitions(id),
  PRIMARY KEY (user_id, card_definition_id)
)
```

---

## Decisiones Cerradas

1. **Fotocards por cantidad** — no instancias individuales. `user_cards(user_id, card_definition_id, quantity, locked_quantity)`.
2. **Origen** — sobres (mecanismo ya implementado en la app).
3. **Mercado global** — sin filtro por era o álbum.
4. **Una carta por oferta** — sin ofertas mixtas.
5. **Sin límite de listings** por usuario.
