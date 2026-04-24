"use client";

import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeftRight } from "lucide-react";
import RarityBadge from "@/components/market/RarityBadge";
import type { TradeHistory, Card } from "@/types";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

type TradeHistoryWithCards = TradeHistory & {
  listed_card: Card;
  offered_card: Card;
};

export interface TradeHistoryItemProps {
  trade: TradeHistory;
  /** ID del usuario autenticado — determina perspectiva (seller vs buyer) */
  userId: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const RARITY_BORDER: Record<string, string> = {
  common:    "rgba(156,163,175,0.20)",
  rare:      "rgba(96,165,250,0.20)",
  epic:      "rgba(168,85,247,0.20)",
  legendary: "rgba(245,158,11,0.30)",
};

function CardThumb({ card }: { card: Card }) {
  const borderColor = RARITY_BORDER[card.rarity] ?? "var(--glass-border)";
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="relative w-14 aspect-[3/4] rounded-lg overflow-hidden shrink-0"
        style={{ border: `1px solid ${borderColor}` }}
      >
        {card.image_url ? (
          <Image
            src={card.image_url}
            alt={card.name}
            fill
            sizes="56px"
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xl bg-purple-500/10">
            💜
          </div>
        )}
      </div>
      <p className="text-[10px] text-[color:var(--text-primary)] font-semibold text-center leading-tight max-w-[56px] truncate">
        {card.name}
      </p>
      <RarityBadge rarity={card.rarity} showPoints={false} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export default function TradeHistoryItem({ trade, userId }: TradeHistoryItemProps) {
  const enriched = trade as Partial<TradeHistoryWithCards>;
  const isSeller = trade.seller_id === userId;

  // Carta que el usuario dio y la que recibió
  const givenCard = isSeller ? enriched.listed_card : enriched.offered_card;
  const receivedCard = isSeller ? enriched.offered_card : enriched.listed_card;

  const timeAgo = formatDistanceToNow(new Date(trade.completed_at), {
    addSuffix: true,
    locale: es,
  });

  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-3"
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--glass-border)",
      }}
    >
      {/* Perspectiva + fecha */}
      <div className="flex items-center justify-between">
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={{
            background: isSeller
              ? "rgba(96,165,250,0.15)"
              : "rgba(168,85,247,0.15)",
            color: isSeller ? "#60a5fa" : "#a855f7",
          }}
        >
          {isSeller ? "Vendiste" : "Compraste"}
        </span>
        <span className="text-[10px] text-[color:var(--text-muted)]">{timeAgo}</span>
      </div>

      {/* Cartas intercambiadas */}
      <div className="flex items-center gap-3">
        {/* Carta dada */}
        <div className="flex-1 flex flex-col items-center gap-1">
          <p className="text-[9px] text-[color:var(--text-muted)] uppercase tracking-wide">
            Cediste
          </p>
          {givenCard ? (
            <CardThumb card={givenCard} />
          ) : (
            <div className="w-14 aspect-[3/4] rounded-lg bg-white/5 flex items-center justify-center text-xs text-[color:var(--text-muted)]">
              ?
            </div>
          )}
        </div>

        {/* Icono central */}
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
          style={{ background: "var(--accent-glow)", border: "1px solid var(--glass-border)" }}
        >
          <ArrowLeftRight className="w-4 h-4" style={{ color: "var(--accent)" }} />
        </div>

        {/* Carta recibida */}
        <div className="flex-1 flex flex-col items-center gap-1">
          <p className="text-[9px] text-[color:var(--text-muted)] uppercase tracking-wide">
            Obtuviste
          </p>
          {receivedCard ? (
            <CardThumb card={receivedCard} />
          ) : (
            <div className="w-14 aspect-[3/4] rounded-lg bg-white/5 flex items-center justify-center text-xs text-[color:var(--text-muted)]">
              ?
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
