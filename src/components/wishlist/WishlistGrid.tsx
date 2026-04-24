"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { useWishlist } from "@/hooks/useWishlist";
import RarityBadge from "@/components/market/RarityBadge";
import WishlistHeart from "./WishlistHeart";
import type { WishlistItem, Card } from "@/types";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

type WishlistItemWithCard = WishlistItem & { cards: Card };

// ---------------------------------------------------------------------------
// Colores de rareza
// ---------------------------------------------------------------------------

const RARITY_BORDER: Record<string, string> = {
  common:    "rgba(156,163,175,0.25)",
  rare:      "rgba(96,165,250,0.25)",
  epic:      "rgba(168,85,247,0.25)",
  legendary: "rgba(245,158,11,0.35)",
};

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

/**
 * Grid de cartas en la wishlist del usuario.
 * Cada carta tiene: imagen, nombre, rareza y botón para quitar de wishlist.
 */
export default function WishlistGrid() {
  const { data: items = [], isLoading } = useWishlist();

  const enrichedItems = items.filter(
    (item): item is WishlistItemWithCard => !!item.cards
  );

  // ---------------------------------------------------------------------------
  // Loading skeleton
  // ---------------------------------------------------------------------------
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl overflow-hidden animate-pulse"
            style={{ background: "var(--bg-surface)" }}
          >
            <div className="aspect-[3/4] bg-white/5" />
            <div className="p-3 space-y-2">
              <div className="h-3 bg-white/5 rounded w-3/4" />
              <div className="h-3 bg-white/5 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (enrichedItems.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="grid grid-cols-2 sm:grid-cols-3 gap-3"
    >
      {enrichedItems.map((item) => {
        const card = item.cards;
        const borderColor = RARITY_BORDER[card.rarity] ?? "var(--glass-border)";

        return (
          <div
            key={item.card_definition_id}
            className="flex flex-col rounded-xl overflow-hidden"
            style={{
              background: "var(--bg-surface)",
              border: `1px solid ${borderColor}`,
              boxShadow:
                card.rarity === "legendary"
                  ? `0 0 20px ${RARITY_BORDER.legendary}`
                  : "var(--shadow-card)",
            }}
          >
            {/* Imagen de la carta */}
            <div className="relative aspect-[3/4]">
              {card.image_url ? (
                <Image
                  src={card.image_url}
                  alt={card.name}
                  fill
                  sizes="(max-width: 640px) 50vw, 25vw"
                  className="object-cover"
                />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center text-4xl"
                  style={{ background: borderColor }}
                >
                  💜
                </div>
              )}

              {/* Botón quitar de wishlist */}
              <div className="absolute top-2 right-2">
                <WishlistHeart cardDefinitionId={item.card_definition_id} />
              </div>
            </div>

            {/* Info */}
            <div className="p-3 flex flex-col gap-2">
              <p className="text-xs font-bold text-[color:var(--text-primary)] truncate leading-tight">
                {card.name}
              </p>

              <div>
                <RarityBadge rarity={card.rarity} showPoints />
              </div>

              {/* Ver en el mercado */}
              <Link
                href={`/market?rarity=${card.rarity}`}
                className="w-full py-1.5 text-center text-[11px] font-bold rounded-lg text-white transition-opacity hover:opacity-90"
                style={{ background: "linear-gradient(135deg, var(--accent), #a855f7)" }}
              >
                Ver en el mercado
              </Link>
            </div>
          </div>
        );
      })}
    </motion.div>
  );
}
