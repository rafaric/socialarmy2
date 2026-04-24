"use client";

import { Heart } from "lucide-react";
import { useIsInWishlist, useToggleWishlist } from "@/hooks/useWishlist";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface WishlistHeartProps {
  cardDefinitionId: string;
  className?: string;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

/**
 * Toggle de corazón para agregar/quitar una carta de la wishlist.
 * Usa optimistic update internamente via useToggleWishlist.
 */
export default function WishlistHeart({ cardDefinitionId, className = "" }: WishlistHeartProps) {
  const isInWishlist = useIsInWishlist(cardDefinitionId);
  const toggleWishlist = useToggleWishlist();

  function handleToggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    toggleWishlist.mutate({ cardDefinitionId, isInWishlist });
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={toggleWishlist.isPending}
      className={`p-1.5 rounded-full transition-all disabled:opacity-50 ${className}`}
      style={{ background: "rgba(0,0,0,0.55)" }}
      aria-label={isInWishlist ? "Quitar de wishlist" : "Agregar a wishlist"}
    >
      <Heart
        className="w-3.5 h-3.5 transition-colors"
        style={{
          fill: isInWishlist ? "#a855f7" : "transparent",
          stroke: isInWishlist ? "#a855f7" : "#fff",
        }}
      />
    </button>
  );
}
