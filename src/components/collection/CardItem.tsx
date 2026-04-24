"use client";

import Image from "next/image";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { UserCard, Card, CardRarity } from "@/types";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface CardItemProps {
  userCard: UserCard & { cards: Card };
  isDragging?: boolean;
  onList?: (card: UserCard & { cards: Card }) => void;
}

// ---------------------------------------------------------------------------
// Config de rareza
// ---------------------------------------------------------------------------

const RARITY_CONFIG: Record<
  CardRarity,
  { label: string; color: string; bg: string }
> = {
  common:    { label: "Común",      color: "#9ca3af", bg: "rgba(156,163,175,0.1)" },
  rare:      { label: "Rara",       color: "#60a5fa", bg: "rgba(96,165,250,0.1)"  },
  epic:      { label: "Épica",      color: "#a855f7", bg: "rgba(168,85,247,0.1)"  },
  legendary: { label: "Legendaria", color: "#f59e0b", bg: "rgba(245,158,11,0.1)"  },
};

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export default function CardItem({ userCard, isDragging, onList }: CardItemProps) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: userCard.card_definition_id,
    data: { userCard },
  });

  const card = userCard.cards;
  const cfg = RARITY_CONFIG[card.rarity];
  const available = userCard.quantity - userCard.locked_quantity;

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    border: `1px solid ${cfg.color}40`,
    background: "var(--bg-surface)",
    boxShadow:
      card.rarity === "legendary"
        ? `0 0 16px ${cfg.color}40`
        : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="rounded-xl overflow-hidden flex flex-col touch-none select-none"
    >
      {/* Imagen */}
      <div className="relative aspect-[3/4]">
        {card.image_url ? (
          <Image
            src={card.image_url}
            alt={card.name}
            fill
            sizes="(max-width: 640px) 33vw, 25vw"
            className="object-cover"
            draggable={false}
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center text-3xl"
            style={{ background: `${cfg.color}10` }}
          >
            💜
          </div>
        )}

        {/* Badge cantidad */}
        <span
          className="absolute top-1 right-1 text-[9px] font-bold px-1 py-0.5 rounded"
          style={{
            background: "rgba(0,0,0,0.65)",
            color: "#fff",
          }}
        >
          x{available}
        </span>

        {/* Indicador de lock */}
        {userCard.locked_quantity > 0 && (
          <span
            className="absolute bottom-1 right-1 text-[9px] px-1 py-0.5 rounded"
            style={{
              background: "rgba(0,0,0,0.55)",
              color: "#f59e0b",
            }}
            title={`${userCard.locked_quantity} reservada(s) en listings/ofertas`}
          >
            🔒 {userCard.locked_quantity}
          </span>
        )}
      </div>

      {/* Footer */}
      <div className="p-2 text-center" style={{ background: `${cfg.color}10` }}>
        <p className="text-[10px] font-bold" style={{ color: cfg.color }}>
          {cfg.label}
        </p>
        <p className="text-[9px] text-[color:var(--text-muted)] truncate">
          {card.name}
        </p>

        {/* Botón fallback accesible */}
        {onList && available >= 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onList(userCard);
            }}
            className="mt-1 w-full text-[8px] font-semibold py-0.5 rounded transition-opacity hover:opacity-80"
            style={{
              background: "var(--accent)20",
              color: "var(--accent)",
            }}
          >
            Listar
          </button>
        )}
      </div>
    </div>
  );
}
