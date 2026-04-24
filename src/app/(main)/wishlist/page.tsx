"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Heart } from "lucide-react";
import { useWishlist } from "@/hooks/useWishlist";
import WishlistGrid from "@/components/wishlist/WishlistGrid";

// ---------------------------------------------------------------------------
// Página /wishlist
// ---------------------------------------------------------------------------

export default function WishlistPage() {
  const { data: items = [], isLoading } = useWishlist();

  const isEmpty = !isLoading && items.length === 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="glass-card p-5">
        <div className="flex items-center gap-3 mb-1">
          <Heart className="w-5 h-5" style={{ color: "var(--accent)" }} />
          <h1 className="text-lg font-bold text-[color:var(--text-primary)]">
            Mi wishlist
          </h1>
        </div>
        <p className="text-xs text-[color:var(--text-muted)]">
          {isLoading
            ? "Cargando..."
            : `${items.length} carta${items.length !== 1 ? "s" : ""} en tu lista de deseos`}
        </p>
      </div>

      {/* Estado vacío */}
      {isEmpty && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-12 text-center space-y-4"
        >
          <p className="text-4xl">💜</p>
          <div>
            <p className="text-[color:var(--text-primary)] font-semibold mb-1">
              Tu lista de deseos está vacía
            </p>
            <p className="text-[color:var(--text-muted)] text-sm">
              Agregá cartas desde el mercado para que te avisemos cuando estén disponibles.
            </p>
          </div>
          <Link
            href="/market"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-90"
            style={{ background: "linear-gradient(135deg, var(--accent), #a855f7)" }}
          >
            Explorá el mercado
          </Link>
        </motion.div>
      )}

      {/* Grid de cartas */}
      {!isEmpty && <WishlistGrid />}
    </div>
  );
}
