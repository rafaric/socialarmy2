"use client";

import { useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import { toast } from "sonner";
import type { UserCard, Card } from "@/types";
import CardItem from "./CardItem";
import CardDropZone from "./CardDropZone";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface CollectionGridProps {
  cards: (UserCard & { cards: Card })[];
  /** Muestra la zona de drop "listar en mercado" */
  marketDropZone?: boolean;
  /** Callback cuando el usuario quiere listar una carta (por drag o por click en botón) */
  onListCard: (card: UserCard & { cards: Card }) => void;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export default function CollectionGrid({
  cards,
  marketDropZone = false,
  onListCard,
}: CollectionGridProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  // -------------------------------------------------------------------------
  // Sensors — configuración mobile-safe
  // PointerSensor: distancia mínima de 8px para no disparar drag en clicks
  // TouchSensor: delay 250ms + tolerancia 8px — CRÍTICO para iOS Safari
  //   Sin el delay, el drag compite con el scroll vertical nativo
  // KeyboardSensor: accesibilidad
  // -------------------------------------------------------------------------
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 8 },
    }),
    useSensor(KeyboardSensor)
  );

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const cardDefinitionId = active.id as string;
    const userCard = cards.find((c) => c.card_definition_id === cardDefinitionId);
    if (!userCard) return;

    // Validación universal: debe haber al menos 1 carta disponible
    const available = userCard.quantity - userCard.locked_quantity;
    if (available < 1) {
      toast.error("Ya tenés esa carta reservada en un listing u oferta activa");
      return;
    }

    if (over.id === "market-drop") {
      onListCard(userCard);
    }

    // Extensible: agregar más destinos (offer-drop, wishlist-drop) en fases siguientes
  }

  // Carta actualmente siendo arrastrada (para el overlay)
  const activeCard = activeId
    ? cards.find((c) => c.card_definition_id === activeId)
    : null;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (cards.length === 0) {
    return (
      <div className="glass-card p-12 text-center">
        <p className="text-4xl mb-3">💜</p>
        <p className="text-[color:var(--text-muted)] text-sm">
          No hay cartas para mostrar.
        </p>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {/* Grid de cartas */}
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
        {cards.map((uc) => (
          <CardItem
            key={uc.card_definition_id}
            userCard={uc}
            isDragging={activeId === uc.card_definition_id}
            onList={onListCard}
          />
        ))}
      </div>

      {/* Zona de drop para listar en mercado */}
      {marketDropZone && (
        <CardDropZone
          id="market-drop"
          variant="market"
          label="Listar en el mercado"
          className="mt-4"
        />
      )}

      {/* Overlay — muestra la carta mientras se arrastra */}
      <DragOverlay dropAnimation={null}>
        {activeCard ? (
          <div className="opacity-90 scale-105 pointer-events-none">
            <CardItem
              userCard={activeCard}
              isDragging={false}
              onList={undefined}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
