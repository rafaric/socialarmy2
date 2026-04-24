"use client";

import type { CardRarity } from "@/types";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface RarityBadgeProps {
  rarity: CardRarity;
  /** Si true muestra también los puntos (ej: "Épica · 8 pts"). Default: true */
  showPoints?: boolean;
  className?: string;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const RARITY_CONFIG: Record<
  CardRarity,
  { label: string; points: number; text: string; bg: string }
> = {
  common:    { label: "Común",      points: 1,  text: "text-gray-400",   bg: "bg-gray-500/20"   },
  rare:      { label: "Rara",       points: 4,  text: "text-blue-400",   bg: "bg-blue-500/20"   },
  epic:      { label: "Épica",      points: 8,  text: "text-purple-400", bg: "bg-purple-500/20" },
  legendary: { label: "Legendaria", points: 16, text: "text-yellow-400", bg: "bg-yellow-500/20" },
};

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export default function RarityBadge({
  rarity,
  showPoints = true,
  className = "",
}: RarityBadgeProps) {
  const cfg = RARITY_CONFIG[rarity];

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${cfg.text} ${cfg.bg} ${className}`}
    >
      {cfg.label}
      {showPoints && (
        <span className="opacity-75">· {cfg.points} pts</span>
      )}
    </span>
  );
}
