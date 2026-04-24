# Spec — Trading System (Sistema de Intercambio de Fotocards)

**Change name**: `trading-system`
**Status**: spec
**Based on**: proposal.md
**Stack**: Next.js 16 App Router, TypeScript, Bun, Supabase, React Query v5, Zustand v5, Framer Motion, Tailwind v4
**RFC keywords**: MUST, SHALL, SHOULD, MAY (RFC 2119)

---

## Decisiones de diseño confirmadas

- **Rareza en fase 1**: 4 niveles solamente — `common` (1 pt), `rare` (4 pts), `epic` (8 pts), `legendary` (16 pts). `uncommon` queda fuera del scope de fase 1.
- **Schema**: `user_cards_v2` reemplaza `user_cards` con PK compuesta `(user_id, card_id)` y columnas `quantity` / `locked_quantity`.
- **Intercambio atómico**: vía RPC PostgreSQL `execute_trade(listing_id, offer_id)` con `FOR UPDATE`.
- **Ofertas**: 1-a-1 únicamente (una carta ofrecida por oferta).
- **Notificaciones**: solo in-app (tabla `notifications`), sin push Expo en fase 1.
- **Drag & drop**: `@dnd-kit` con `TouchSensor` (delay 250ms). Fallback: botón "Listar" en mobile.

---

## F-01: Gestión de inventario (user_cards_v2, stacking, locked_quantity, migración)

### Requisitos

- El sistema MUST migrar la tabla `user_cards` (una fila por instancia individual) a `user_cards_v2` usando `GROUP BY (user_id, card_id)` con `COUNT(*) AS quantity` y `MIN(obtained_at) AS first_obtained_at`.
- La migración MUST ser idempotente (`ON CONFLICT (user_id, card_id) DO NOTHING`).
- El sistema MUST mantener la tabla `user_cards` renombrada como `user_cards_legacy` durante un mínimo de 2 semanas post-deploy para permitir rollback.
- El sistema MUST validar antes de activar el rename que `SUM(quantity)` en `user_cards_v2` por usuario sea igual a `COUNT(*)` en `user_cards` por usuario.
- El sistema MUST agregar la columna `rarity_points` a la tabla `cards` con valores: `common=1`, `rare=4`, `epic=8`, `legendary=16`. Esta columna MUST ser `NOT NULL`.
- El campo `locked_quantity` MUST cumplir siempre `0 <= locked_quantity <= quantity`.
- El sistema MUST exponer `quantity` y `locked_quantity` en todos los endpoints y hooks que retornan datos de la colección del usuario.
- El sistema SHOULD calcular `available_quantity = quantity - locked_quantity` en el lado del servidor antes de enviar respuestas, nunca confiar en cálculo del cliente para validaciones.
- La columna `for_trade` en la tabla `user_cards` (legacy) MUST ser marcada como deprecada en la migración. No se usará en el nuevo schema.
- El sistema MUST rechazar cualquier operación que deje `quantity < 0` o `locked_quantity < 0` en `user_cards_v2`.

### Scenario: Vista de colección con stacking

```
Given: el usuario autenticado tiene 3 instancias de la carta "BTS Jungkook Rare" en user_cards (legacy)
When: se ejecuta la migración a user_cards_v2
Then: existe exactamente 1 fila (user_id, card_jungkook_rare_id) con quantity=3, locked_quantity=0
And: first_obtained_at es la fecha más antigua de las 3 instancias originales
And: user_cards_legacy conserva las 3 filas originales intactas
```

### Scenario: Validación de suma post-migración

```
Given: el usuario tiene 5 cartas distintas en user_cards (legacy) con 2, 1, 3, 1, 2 instancias
When: se ejecuta la validación post-migración para ese usuario
Then: SUM(quantity) en user_cards_v2 para ese usuario = 9
And: COUNT(*) en user_cards para ese usuario = 9
And: la validación pasa (no lanza error)
```

### Scenario: Consistencia de locked_quantity

```
Given: el usuario tiene quantity=2, locked_quantity=0 para la carta X
And: crea 2 ofertas usando la carta X en 2 listings distintos
Then: locked_quantity=2
When: se intenta crear una tercera oferta usando la carta X
Then: la API retorna 422 con error "available_quantity insuficiente"
And: locked_quantity permanece en 2
```

### Scenario: Rollback de migración

```
Given: la migración detecta que SUM(quantity) en user_cards_v2 para algún usuario != COUNT(*) en user_cards
When: se ejecuta la validación post-migración
Then: la migración lanza un error y hace rollback de la transacción
And: user_cards_legacy permanece intacta
And: el deploy se aborta con mensaje de error descriptivo
```

---

## F-02: Listings en el mercado (crear, cancelar, expirar, auto_accept)

### Requisitos

- El sistema MUST requerir autenticación para crear, cancelar o consultar listings propios.
- El sistema MUST validar al crear un listing que `quantity - locked_quantity >= 1` para la carta del vendedor.
- El sistema MUST decrementar `quantity` en 1 en `user_cards_v2` del vendedor al crear un listing. La carta sale del inventario inmediatamente.
- El sistema MUST crear el listing con `status = 'active'` y `expires_at = now() + interval '30 days'`.
- El sistema MUST rechazar la creación de un listing si el vendedor ya tiene un listing `active` para la misma carta. Un usuario MUST NOT tener más de un listing activo por carta en simultáneo.
- El campo `auto_accept` MUST ser `boolean`, enviado en el body del POST. Si `true`, la primera oferta válida que llegue se acepta automáticamente. Si `false`, el vendedor debe aceptar manualmente.
- El sistema MUST permitir al vendedor cancelar su propio listing solo si `status = 'active'`.
- Al cancelar un listing, el sistema MUST devolver la carta al inventario del vendedor (`quantity += 1` en `user_cards_v2`) y rechazar (cascade) todas las ofertas `pending` del listing, liberando `locked_quantity` de cada comprador.
- El sistema MUST rechazar la cancelación de un listing con `status != 'active'` (retornar 409 Conflict).
- El endpoint GET `/api/market/listings` MUST retornar solo listings con `status = 'active'`.
- El sistema SHOULD paginar el listado del mercado (máximo 20 listings por página).
- El sistema MUST aplicar rate limiting en el endpoint POST `/api/market/listings`.

### Scenario: Crear listing válido (modo manual)

```
Given: el usuario autenticado tiene quantity=2, locked_quantity=0 para la carta "BTS RM Epic"
When: envía POST /api/market/listings con { card_id: "bts-rm-epic-id", auto_accept: false }
Then: la API retorna 201 con el listing creado en status "active"
And: quantity del usuario para esa carta pasa de 2 a 1
And: locked_quantity permanece en 0
And: el listing aparece en GET /api/market/listings
```

### Scenario: Crear listing con inventario insuficiente

```
Given: el usuario tiene quantity=1, locked_quantity=1 para la carta "BTS RM Epic"
When: envía POST /api/market/listings con { card_id: "bts-rm-epic-id", auto_accept: false }
Then: la API retorna 422 con error "available_quantity insuficiente"
And: quantity y locked_quantity no se modifican
And: no se crea ningún listing
```

### Scenario: Crear listing (modo auto_accept)

```
Given: el usuario tiene quantity=1, locked_quantity=0 para la carta "TWICE Nayeon Legendary"
When: envía POST /api/market/listings con { card_id: "nayeon-leg-id", auto_accept: true }
Then: la API retorna 201 con listing.auto_accept=true
And: quantity del usuario pasa de 1 a 0
```

### Scenario: Cancelar listing propio

```
Given: el usuario tiene un listing activo de la carta "BTS Jin Rare"
And: hay 2 ofertas pending de compradores distintos (cada uno con locked_quantity+=1)
When: el vendedor envía DELETE /api/market/listings/{id}
Then: el listing pasa a status "cancelled"
And: quantity del vendedor para esa carta aumenta en 1 (se devuelve la carta)
And: las 2 ofertas pending pasan a status "cancelled"
And: locked_quantity de cada comprador disminuye en 1 (se liberan los locks)
And: el listing ya no aparece en GET /api/market/listings
```

### Scenario: Cancelar listing de otro usuario

```
Given: un listing activo pertenece al usuario A
When: el usuario B envía DELETE /api/market/listings/{id} del usuario A
Then: la API retorna 403 Forbidden
And: el listing permanece activo
```

### Scenario: Cancelar listing ya completado

```
Given: un listing con status "completed"
When: el vendedor intenta enviarlo DELETE /api/market/listings/{id}
Then: la API retorna 409 Conflict con error "listing_not_cancellable"
```

---

## F-03: Ofertas (crear oferta, validación de puntos, lock de cartas, una carta por oferta)

### Requisitos

- El sistema MUST validar que `rarity_points(offered_card) >= rarity_points(listed_card)` antes de aceptar una oferta.
- El sistema MUST lockear la carta ofrecida del comprador (`locked_quantity += 1` en `user_cards_v2`) al crear la oferta.
- El sistema MUST rechazar la oferta si `quantity - locked_quantity < 1` para la carta que el comprador intenta ofrecer.
- El sistema MUST impedir que el vendedor haga una oferta sobre su propio listing (retornar 422).
- El sistema MUST impedir que un comprador haga más de una oferta `pending` usando la misma carta en el mismo listing. La constraint `UNIQUE(listing_id, buyer_id, offered_card_id, status)` en base de datos aplica.
- El sistema MUST rechazar ofertas sobre listings con `status != 'active'` (retornar 422).
- El sistema MUST rechazar ofertas sobre listings expirados (`expires_at < now()`), incluso si aún tienen `status = 'active'` (el cron puede no haber corrido aún).
- Una oferta contiene exactamente 1 carta. El sistema MUST NOT aceptar ofertas con múltiples cartas.
- El sistema MUST aplicar rate limiting en POST `/api/market/listings/[id]/offers` (máximo 5 ofertas/minuto por usuario).
- Si el listing tiene `auto_accept = true`, el sistema MUST ejecutar el intercambio atómico inmediatamente tras crear la oferta (llamar a `execute_trade` dentro de la misma request).
- El sistema MUST retornar la oferta creada en el body de la respuesta 201 (incluyendo `status`).
- Al rechazar una oferta (seller), el sistema MUST liberar el `locked_quantity` de la carta ofrecida del comprador (`locked_quantity -= 1`).
- Al cancelar una oferta propia (buyer), el sistema MUST liberar el `locked_quantity` del comprador y poner la oferta en `status = 'cancelled'`.

### Scenario: Oferta válida (puntos suficientes)

```
Given: un listing activo de una carta "BTS Jimin Rare" (4 pts)
And: el comprador tiene quantity=1, locked_quantity=0 para "TWICE Dahyun Epic" (8 pts)
When: el comprador envía POST /api/market/listings/{id}/offers con { offered_card_id: "dahyun-epic-id" }
Then: la oferta se crea en status "pending"
And: locked_quantity del comprador para "TWICE Dahyun Epic" pasa de 0 a 1
And: el vendedor recibe notificación tipo "trade_offer_received"
And: la API retorna 201 con la oferta creada
```

### Scenario: Oferta con puntos insuficientes

```
Given: un listing activo de una carta "BTS RM Epic" (8 pts)
And: el comprador quiere ofrecer "TWICE Jeongyeon Rare" (4 pts)
When: el comprador envía POST /api/market/listings/{id}/offers con { offered_card_id: "jeongyeon-rare-id" }
Then: la API retorna 422 con error "rarity_points insuficientes"
And: locked_quantity del comprador no se modifica
And: no se crea ninguna oferta
```

### Scenario: Oferta sin disponibilidad de la carta

```
Given: el comprador tiene quantity=1, locked_quantity=1 para "TWICE Nayeon Legendary"
When: intenta ofrecer "TWICE Nayeon Legendary" en cualquier listing
Then: la API retorna 422 con error "available_quantity insuficiente"
And: no se modifica locked_quantity
```

### Scenario: Vendedor intenta ofertar en su propio listing

```
Given: un listing activo creado por el usuario A
When: el usuario A envía POST /api/market/listings/{id}/offers (con cualquier carta)
Then: la API retorna 422 con error "no_self_offer"
And: no se crea ninguna oferta
```

### Scenario: Oferta sobre listing expirado (cron aún no corrió)

```
Given: un listing con expires_at en el pasado pero aún en status "active" (cron no corrió)
When: cualquier comprador intenta hacer una oferta
Then: la API retorna 422 con error "listing_expired"
And: no se crea ninguna oferta
And: no se modifica locked_quantity del comprador
```

### Scenario: Auto-accept — ejecución inmediata

```
Given: un listing activo con auto_accept=true de una carta "BTS V Rare" (4 pts)
And: el comprador tiene una carta "TWICE Sana Epic" (8 pts) disponible
When: el comprador envía POST /api/market/listings/{id}/offers con { offered_card_id: "sana-epic-id" }
Then: la oferta se crea en status "accepted"
And: el intercambio se ejecuta atómicamente (execute_trade llama en la misma request)
And: el listing pasa a status "completed"
And: el comprador recibe "BTS V Rare" en su inventario
And: el vendedor recibe "TWICE Sana Epic" en su inventario
And: la API retorna 201 con offer.status="accepted"
And: no quedan ofertas pending en ese listing
```

### Scenario: Cancelar oferta propia (buyer)

```
Given: el comprador tiene una oferta pending en un listing activo
And: locked_quantity de su carta ofrecida es 1 (por esta oferta)
When: el comprador envía DELETE /api/market/offers/{offer_id}
Then: la oferta pasa a status "cancelled"
And: locked_quantity del comprador disminuye en 1
And: el listing sigue activo
```

---

## F-04: Intercambio atómico (accept manual y automático, reject cascade, atomicidad)

### Requisitos

- El intercambio MUST ejecutarse dentro de una única transacción PostgreSQL via la función RPC `execute_trade(p_listing_id, p_offer_id)`.
- La función RPC MUST adquirir locks `FOR UPDATE` sobre el listing y la oferta antes de modificar cualquier dato.
- La función RPC MUST validar que `listing.status = 'active'` y `offer.status = 'pending'` dentro de la transacción, después del lock.
- La función RPC MUST validar que `rarity_points(offered_card) >= rarity_points(listed_card)` dentro de la transacción (doble validación, la primera ocurre en la API route).
- Al aceptar, el sistema MUST transferir `listed_card` del seller al buyer: `seller.quantity -= 1`, `buyer.quantity += 1` (upsert).
- Al aceptar, el sistema MUST transferir `offered_card` del buyer al seller: `buyer.quantity -= 1`, `buyer.locked_quantity -= 1`, `seller.quantity += 1` (upsert).
- Al aceptar, el sistema MUST marcar el listing como `completed` y la oferta aceptada como `accepted`.
- El sistema MUST rechazar en cascade todas las demás ofertas `pending` del listing al completar el intercambio, liberando `locked_quantity` de cada comprador rechazado.
- El sistema MUST insertar un registro en `trade_history` con los IDs de todas las partes involucradas.
- El sistema MUST enviar notificación `trade_offer_accepted` al comprador ganador y `trade_offer_rejected` a los compradores rechazados.
- Si la función RPC retorna `ok: false`, la API route MUST retornar el error apropiado sin modificar ningún dato (la transacción ya hizo rollback).
- Solo el vendedor MUST poder llamar al endpoint POST `/api/market/offers/[id]/accept` (modo manual).
- El sistema MUST retornar 403 si un no-vendedor intenta aceptar una oferta.

### Scenario: Accept manual exitoso

```
Given: un listing activo (mode manual) de "BTS Jungkook Legendary" (16 pts) del usuario A
And: el usuario B tiene una oferta pending con "TWICE Nayeon Legendary" (16 pts), locked_quantity=1
And: el usuario C tiene una oferta pending con "TWICE Sana Epic" (8 pts), locked_quantity=1
When: el usuario A llama POST /api/market/offers/{oferta_B_id}/accept
Then: execute_trade se ejecuta exitosamente en una sola transacción
And: el usuario B recibe "BTS Jungkook Legendary" (quantity += 1)
And: el usuario A recibe "TWICE Nayeon Legendary" (quantity += 1)
And: el inventario del usuario B: quantity de "TWICE Nayeon Legendary" -= 1, locked_quantity -= 1
And: el listing pasa a status "completed" con completed_at = now()
And: la oferta del usuario B pasa a status "accepted"
And: la oferta del usuario C pasa a status "rejected"
And: locked_quantity del usuario C para "TWICE Sana Epic" disminuye en 1
And: se inserta una fila en trade_history
And: el usuario B recibe notificación "trade_offer_accepted"
And: el usuario C recibe notificación "trade_offer_rejected"
```

### Scenario: Race condition — doble accept simultáneo

```
Given: un listing activo con una oferta pending
When: dos requests simultáneas intentan llamar execute_trade con la misma (listing_id, offer_id)
Then: solo una transacción obtiene el FOR UPDATE lock y procede
And: la segunda transacción falla con error "offer_invalid" (la oferta ya no está pending)
And: el estado final es coherente: solo un intercambio ejecutado
```

### Scenario: Accept con listing ya completado

```
Given: un listing en status "completed"
When: el vendedor intenta POST /api/market/offers/{id}/accept
Then: execute_trade retorna ok=false con error "listing_not_active"
And: la API retorna 422 con el error
And: ningún dato es modificado
```

### Scenario: Reject de oferta individual (modo manual)

```
Given: una oferta pending del usuario B en un listing activo del usuario A
And: locked_quantity del usuario B para su carta ofrecida es 1
When: el usuario A envía POST /api/market/offers/{oferta_B_id}/reject
Then: la oferta pasa a status "rejected"
And: locked_quantity del usuario B disminuye en 1 (la carta queda disponible)
And: el listing sigue activo (puede recibir otras ofertas)
And: el usuario B recibe notificación "trade_offer_rejected"
```

### Scenario: Atomicidad — falla a mitad de transferencia

```
Given: execute_trade está en medio de la transferencia (seller perdió la carta, buyer aún no la recibió)
When: ocurre un error de base de datos (timeout, deadlock, constraint violation)
Then: la transacción hace rollback completo
And: los inventarios de seller y buyer quedan en su estado previo
And: el listing sigue en status "active"
And: la oferta sigue en status "pending"
And: locked_quantity de los compradores no se modifica
```

---

## F-05: Wishlist (agregar, quitar, notificación cuando aparece en mercado)

### Requisitos

- El sistema MUST permitir a cualquier usuario autenticado agregar cartas a su wishlist.
- El sistema MUST retornar 409 Conflict si el usuario intenta agregar una carta que ya está en su wishlist.
- El sistema MUST permitir al usuario quitar cartas de su wishlist.
- El sistema MUST retornar la wishlist del usuario ordenada por `created_at DESC` en GET `/api/wishlist`.
- La wishlist MUST incluir los datos completos de la carta (`cards.*`) en cada entrada (join con tabla `cards`).
- Al crear un nuevo listing en el mercado, el sistema MUST buscar usuarios que tienen la carta listada en su wishlist y crear notificaciones tipo `wishlist_card_listed` para cada uno de ellos.
- El sistema MUST NOT enviar notificación `wishlist_card_listed` al propio vendedor si tiene la carta en su wishlist.
- El sistema SHOULD limitar las notificaciones de wishlist para no enviar más de 1 notificación por carta por período de 24 horas al mismo usuario (previene spam si el mismo card se lista/cancela repetidamente).
- El sistema MUST eliminar entradas de wishlist cuando el usuario elimina su cuenta (`ON DELETE CASCADE` en `user_id`).

### Scenario: Agregar carta a wishlist

```
Given: el usuario autenticado no tiene "BTS Jin Rare" en su wishlist
When: envía POST /api/wishlist con { card_id: "bts-jin-rare-id" }
Then: la API retorna 201 con la entrada de wishlist creada
And: GET /api/wishlist retorna la carta en la lista del usuario
```

### Scenario: Agregar carta duplicada

```
Given: el usuario ya tiene "BTS Jin Rare" en su wishlist
When: envía POST /api/wishlist con { card_id: "bts-jin-rare-id" }
Then: la API retorna 409 Conflict con error "already_in_wishlist"
And: no se crea una segunda entrada
```

### Scenario: Quitar carta de wishlist

```
Given: el usuario tiene "TWICE Nayeon Legendary" en su wishlist
When: envía DELETE /api/wishlist/nayeon-legendary-id
Then: la API retorna 200 (o 204)
And: GET /api/wishlist ya no incluye esa carta
```

### Scenario: Notificación cuando aparece carta en mercado

```
Given: el usuario A tiene "BTS RM Epic" en su wishlist
And: el usuario B tiene "BTS RM Epic" en su wishlist
And: el usuario C (vendedor) NO tiene "BTS RM Epic" en su wishlist
When: el usuario C crea un listing de "BTS RM Epic"
Then: el usuario A recibe notificación "wishlist_card_listed" con referencia al listing
And: el usuario B recibe notificación "wishlist_card_listed" con referencia al listing
And: el usuario C NO recibe notificación (es el vendedor)
```

### Scenario: Notificación no se duplica en 24h

```
Given: el usuario A tiene "BTS RM Epic" en su wishlist
And: el usuario A ya recibió notificación "wishlist_card_listed" para esa carta hace 2 horas
When: aparece un nuevo listing de "BTS RM Epic"
Then: el usuario A NO recibe una segunda notificación "wishlist_card_listed"
(se suprime para evitar spam dentro de la ventana de 24h)
```

---

## F-06: Notificaciones (6 tipos nuevos, cuándo se disparan)

### Requisitos

- El sistema MUST extender `NotificationType` en `src/types/index.ts` con exactamente 6 nuevos tipos.
- El sistema MUST insertar notificaciones en la tabla `notifications` existente para cada evento relevante.
- Cada notificación MUST incluir un `reference_id` que permita navegar al recurso relacionado (listing_id u offer_id).
- El sistema MUST enviar las notificaciones desde las API routes correspondientes (o desde triggers de Supabase si corresponde), nunca confiar solo en el cliente.

#### Tabla de tipos de notificaciones

| Tipo | Descripción | Disparado por | Destinatario |
|------|-------------|---------------|--------------|
| `trade_offer_received` | Nueva oferta en tu listing | POST `/api/market/listings/[id]/offers` | Seller |
| `trade_offer_accepted` | Tu oferta fue aceptada | POST `/api/market/offers/[id]/accept` o auto-accept | Buyer ganador |
| `trade_offer_rejected` | Tu oferta fue rechazada | POST `/api/market/offers/[id]/reject` o reject cascade al completar | Buyer rechazado |
| `wishlist_card_listed` | Carta de tu wishlist está en el mercado | POST `/api/market/listings` | Usuarios con esa carta en wishlist |
| `listing_expired` | Tu listing expiró sin completarse | GET `/api/cron/expire-listings` | Seller |
| `trade_match_suggested` | Alguien tiene lo que querés y querés lo que tiene | Match engine job (Fase 5.5) | Ambas partes del match |

### Requisitos adicionales por tipo

- `trade_offer_received`: MUST enviarse inmediatamente al crear la oferta, excepto en auto_accept (donde el trade ya se completó y se envían `trade_offer_accepted`/`trade_offer_rejected` en su lugar).
- `trade_offer_accepted`: MUST incluir `reference_id = offer_id` para que el buyer vea qué carta recibió.
- `trade_offer_rejected`: MUST incluir `reference_id = offer_id`. En reject cascade, el sistema MUST crear una notificación por cada offer rechazada.
- `listing_expired`: MUST incluir `reference_id = listing_id`. La carta MUST haberse devuelto al inventario del seller antes de enviar la notificación.
- `trade_match_suggested`: está en scope de Fase 5.5 (opcional). En Fase 1-4, el tipo MUST existir en el tipo union pero no necesariamente dispararse.

### Scenario: Notificación trade_offer_received

```
Given: el usuario A tiene un listing activo (modo manual)
When: el usuario B crea una oferta válida en ese listing
Then: se inserta una fila en notifications con { user_id: A, type: "trade_offer_received", reference_id: offer_id }
And: si el usuario A está en la app, ve la notificación en tiempo real (via Supabase Realtime)
```

### Scenario: Notificación en auto-accept (no hay trade_offer_received)

```
Given: el usuario A tiene un listing con auto_accept=true
When: el usuario B envía una oferta válida
Then: NO se inserta notificación "trade_offer_received" para el usuario A
And: SÍ se inserta notificación "trade_offer_accepted" para el usuario B
And: el intercambio se completa en la misma request
```

### Scenario: Reject cascade genera notificaciones masivas

```
Given: un listing con 3 ofertas pending (usuarios B, C, D)
When: el vendedor A acepta la oferta del usuario B
Then: execute_trade rechaza las ofertas de C y D en cascade
And: se insertan notificaciones "trade_offer_rejected" para C y D
And: se inserta notificación "trade_offer_accepted" para B
```

### Scenario: listing_expired vía cron

```
Given: un listing del usuario A con expires_at en el pasado y 1 oferta pending del usuario B
When: el cron /api/cron/expire-listings corre
Then: el listing pasa a status "expired"
And: la oferta pending pasa a status "cancelled"
And: locked_quantity del usuario B disminuye en 1
And: quantity del usuario A (la carta listada) aumenta en 1 (se devuelve)
And: se inserta notificación "listing_expired" para el usuario A
```

---

## F-07: Expiración (cron job que expira listings a 30 días)

### Requisitos

- El sistema MUST tener un cron job en `src/app/api/cron/expire-listings/route.ts` (integrándose con el directorio cron existente).
- El cron MUST correr periódicamente (frecuencia recomendada: cada hora en Vercel Cron).
- El cron MUST procesar todos los listings con `status = 'active'` y `expires_at <= now()`.
- El cron MUST, para cada listing expirado:
  1. Marcar el listing como `status = 'expired'`.
  2. Cancelar todas sus ofertas `pending` (`status = 'cancelled'`).
  3. Liberar `locked_quantity` de cada comprador con oferta cancelada.
  4. Devolver la carta listada al inventario del vendedor (`quantity += 1`).
  5. Enviar notificación `listing_expired` al vendedor.
- La lógica de expiración MUST ser idempotente: correr el cron dos veces sobre el mismo listing NO debe duplicar devoluciones de carta ni notificaciones.
- El cron MUST estar protegido con un secret de autenticación (header `Authorization: Bearer {CRON_SECRET}` o equivalente al patrón existente en `src/app/api/cron/`).
- El cron SHOULD procesar listings en batches si hay muchos (evitar timeouts de Vercel en un solo request largo).
- El cron SHOULD retornar un resumen en el body de la respuesta: `{ processed: N, errors: [] }`.

### Scenario: Expiración de listing sin ofertas

```
Given: un listing activo del usuario A con expires_at hace 2 horas y 0 ofertas
When: el cron corre
Then: el listing pasa a status "expired"
And: quantity del usuario A para esa carta aumenta en 1
And: se inserta notificación "listing_expired" para el usuario A
And: el cron retorna { processed: 1, errors: [] }
```

### Scenario: Expiración de listing con múltiples ofertas

```
Given: un listing activo del usuario A con expires_at en el pasado
And: 2 ofertas pending del usuario B (carta X, locked_quantity=1) y el usuario C (carta Y, locked_quantity=1)
When: el cron corre
Then: el listing pasa a status "expired"
And: las 2 ofertas pasan a status "cancelled"
And: locked_quantity del usuario B disminuye en 1
And: locked_quantity del usuario C disminuye en 1
And: quantity del usuario A (carta listada) aumenta en 1
And: el usuario A recibe notificación "listing_expired"
```

### Scenario: Idempotencia del cron

```
Given: un listing ya en status "expired" (ya fue procesado en una corrida anterior)
When: el cron vuelve a correr
Then: el listing NO es procesado nuevamente (no tiene status "active")
And: quantity del usuario A NO aumenta una segunda vez
And: NO se envía una segunda notificación "listing_expired"
```

### Scenario: Cron sin autenticación

```
Given: el cron endpoint /api/cron/expire-listings
When: una request llega sin el header de autenticación correcto
Then: la API retorna 401 Unauthorized
And: no se procesa ningún listing
```

---

## Constraints y reglas transversales

### Autenticación y autorización

- Todos los endpoints de escritura MUST validar la sesión con `createClient()` server-side.
- Todos los endpoints que requieren bypass de RLS (writes en `user_cards_v2`, `market_listings`, `trade_offers`, `notifications`) MUST usar el cliente admin.
- Cada endpoint de escritura MUST verificar que el `user_id` del JWT coincida con el recurso que se intenta modificar (ownership check) antes de proceder.

### Rate limiting

- POST `/api/market/listings`: MUST aplicar rate limiting (usar helper `rateLimit` existente).
- POST `/api/market/listings/[id]/offers`: MUST aplicar rate limiting de 5 req/minuto por usuario.
- El resto de los endpoints SHOULD aplicar rate limiting general.

### Validaciones de input

- `card_id` y `offered_card_id` MUST ser UUIDs válidos. La API MUST retornar 400 si no lo son.
- `auto_accept` MUST ser un boolean estricto (no string "true"). La API MUST retornar 400 si no lo es.
- Los endpoints MUST retornar 422 para errores de reglas de negocio (puntos insuficientes, carta no disponible, etc.) y 400 para errores de validación de input.

### Tipos TypeScript

- Los nuevos tipos (`UserCardEntry`, `MarketListing`, `TradeOffer`, `TradeHistoryEntry`, `WishlistEntry`, `NotificationType`, `Rarity`, `ListingStatus`, `OfferStatus`) MUST agregarse a `src/types/index.ts`.
- El sistema MUST pasar `bunx tsc --noEmit` sin errores tras cada cambio.

### Realtime

- El hook `useRealtimeOffers(listingId)` MUST suscribirse al canal `realtime-listing-{listingId}` en Supabase Realtime y escuchar INSERT en `trade_offers` filtrado por `listing_id`.
- Si Supabase Realtime no está disponible (replication no activada), el sistema SHOULD hacer fallback a `refetchInterval: 15_000` en el hook `useListingOffers`.

---

## Cobertura de testing (Strict TDD)

Para cada feature, MUST existir tests en vitest + @testing-library/react ANTES de la implementación.

### Tests de API routes (vitest, server-side)

- F-01: test de migración (sum de quantity = count legacy), test de validación de constraint `locked_quantity <= quantity`.
- F-02: test de create listing (válido, sin inventario, listing duplicado), test de cancel (propio, ajeno, ya completado).
- F-03: test de create offer (válido, puntos insuficientes, sin disponibilidad, self-offer, listing expirado, auto-accept).
- F-04: test de execute_trade (éxito, race condition mock, rollback por error, oferta ya no pending).
- F-05: test de wishlist (add, duplicate, remove, notificación al crear listing).
- F-07: test del cron (listing sin ofertas, listing con ofertas, idempotencia, sin autenticación).

### Tests de hooks (vitest + React Testing Library)

- `useMarketListings`: retorna solo listings activos, pagina correctamente.
- `useCreateListing`: optimistic update, rollback si falla.
- `useCreateOffer`: maneja 422 con mensaje de error apropiado.
- `useWishlist`: agrega y elimina cartas.
- `useRealtimeOffers`: se suscribe al canal correcto.

---

## Archivos afectados

| Archivo | Cambio |
|---------|--------|
| `src/types/index.ts` | Agregar tipos: `Rarity`, `ListingStatus`, `OfferStatus`, `UserCardEntry`, `MarketListing`, `TradeOffer`, `TradeHistoryEntry`, `WishlistEntry`, extender `NotificationType` |
| `src/hooks/useMarket.ts` | Nuevo archivo: hooks del mercado |
| `src/hooks/useTradeHistory.ts` | Nuevo archivo |
| `src/hooks/useWishlist.ts` | Nuevo archivo |
| `src/hooks/useRealtimeMarket.ts` | Nuevo archivo |
| `src/app/api/market/listings/route.ts` | Nuevo: GET y POST |
| `src/app/api/market/listings/[id]/route.ts` | Nuevo: DELETE |
| `src/app/api/market/listings/[id]/offers/route.ts` | Nuevo: GET y POST |
| `src/app/api/market/offers/[id]/accept/route.ts` | Nuevo: POST |
| `src/app/api/market/offers/[id]/reject/route.ts` | Nuevo: POST |
| `src/app/api/market/offers/[id]/route.ts` | Nuevo: DELETE (cancel oferta) |
| `src/app/api/market/history/route.ts` | Nuevo: GET |
| `src/app/api/wishlist/route.ts` | Nuevo: GET y POST |
| `src/app/api/wishlist/[card_id]/route.ts` | Nuevo: DELETE |
| `src/app/api/cron/expire-listings/route.ts` | Nuevo: GET (cron) |
| `src/app/(main)/market/page.tsx` | Nueva página |
| `src/app/(main)/market/[listingId]/page.tsx` | Nueva página |
| `src/app/(main)/market/my-listings/page.tsx` | Nueva página |
| `src/app/(main)/wishlist/page.tsx` | Nueva página |
| `src/app/(main)/trade-history/page.tsx` | Nueva página |
| `src/app/(main)/collection/page.tsx` | Refactor para usar user_cards_v2 |
| `src/components/market/` | Nuevos componentes: CardDraggable, MarketDropZone, OfferDropZone, ListingCard, OfferCard, ListingFormModal, OfferReviewModal, RarityPointsBadge, WishlistHeart, TradeHistoryItem |
| Supabase migrations | Nuevas tablas: user_cards_v2, market_listings, trade_offers, trade_history, wishlists; RPC execute_trade; ALTER cards ADD rarity_points |

---

## Decisiones abiertas a confirmar antes de implementar

1. **Supabase Realtime**: confirmar que la replication está activada para `trade_offers` en el proyecto Supabase antes de Fase 3.
2. **Ventana de mantenimiento**: el rename `user_cards → user_cards_legacy`, `user_cards_v2 → user_cards` requiere coordinación. ¿Deploy con ventana de mantenimiento o dual-write?
3. **Frecuencia del cron**: Vercel Cron en plan gratuito permite mínimo 1 vez por día. Si se requiere cada hora, confirmar plan de Vercel.
4. **Match engine** (`trade_match_suggested`): en scope de Fase 5.5. Confirmar si se incluye en implementación inicial o se deja solo el tipo definido.
