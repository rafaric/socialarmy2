"use client";

import { useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { useCreateListing } from "@/hooks/useMarket";
import type { UserCard, Card, CardRarity } from "@/types";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface ListingModalProps {
  card: (UserCard & { cards: Card }) | null;
  open: boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Config rareza (inline para no depender de otro componente en esta fase)
// ---------------------------------------------------------------------------

const RARITY_COLOR: Record<CardRarity, string> = {
  common:    "#9ca3af",
  rare:      "#60a5fa",
  epic:      "#a855f7",
  legendary: "#f59e0b",
};

const RARITY_LABEL: Record<CardRarity, string> = {
  common:    "Común",
  rare:      "Rara",
  epic:      "Épica",
  legendary: "Legendaria",
};

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export default function ListingModal({ card, open, onClose }: ListingModalProps) {
  const [autoAccept, setAutoAccept] = useState(false);
  const createListing = useCreateListing();

  if (!card) return null;

  const available = card.quantity - card.locked_quantity;
  const rarityColor = RARITY_COLOR[card.cards.rarity];
  const rarityLabel = RARITY_LABEL[card.cards.rarity];

  async function handleConfirm() {
    if (!card) return;
    if (available < 1) {
      toast.error("No tenés unidades disponibles de esta carta");
      return;
    }

    try {
      await createListing.mutateAsync({
        card_definition_id: card.card_definition_id,
        auto_accept: autoAccept,
      });
      toast.success("Carta listada en el mercado");
      onClose();
      setAutoAccept(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al listar la carta";
      toast.error(msg);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="listing-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40"
            style={{ background: "rgba(0,0,0,0.6)" }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            key="listing-modal"
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="fixed bottom-0 left-0 right-0 z-50 sm:relative sm:inset-auto sm:mx-auto sm:mt-20 sm:max-w-sm"
          >
            <div
              className="glass-card rounded-t-2xl sm:rounded-2xl p-6 space-y-5"
              style={{ border: `1px solid ${rarityColor}40` }}
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-[color:var(--text-primary)]">
                  Listar en el mercado
                </h2>
                <button
                  type="button"
                  onClick={onClose}
                  className="text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)] transition-colors text-lg leading-none"
                  aria-label="Cerrar"
                >
                  ✕
                </button>
              </div>

              {/* Preview de la carta */}
              <div className="flex gap-4 items-center">
                <div
                  className="relative w-20 shrink-0 rounded-xl overflow-hidden"
                  style={{
                    aspectRatio: "3/4",
                    border: `1px solid ${rarityColor}40`,
                  }}
                >
                  {card.cards.image_url ? (
                    <Image
                      src={card.cards.image_url}
                      alt={card.cards.name}
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center text-2xl"
                      style={{ background: `${rarityColor}10` }}
                    >
                      💜
                    </div>
                  )}
                </div>

                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-bold text-[color:var(--text-primary)] truncate">
                    {card.cards.name}
                  </p>
                  <p className="text-xs font-semibold" style={{ color: rarityColor }}>
                    {rarityLabel} · {card.cards.rarity_points} pts
                  </p>
                  {card.cards.member && (
                    <p className="text-xs text-[color:var(--text-muted)]">
                      {card.cards.member}
                      {card.cards.era ? ` · ${card.cards.era}` : ""}
                    </p>
                  )}
                  <p className="text-xs text-[color:var(--text-muted)]">
                    Disponibles: <strong className="text-[color:var(--text-primary)]">{available}</strong>
                  </p>
                </div>
              </div>

              {/* Error si no hay disponibles */}
              {available < 1 && (
                <p className="text-xs text-red-400 text-center">
                  No tenés unidades disponibles de esta carta.
                </p>
              )}

              {/* Toggle auto-accept */}
              <label className="flex items-start gap-3 cursor-pointer group">
                <div className="relative mt-0.5">
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={autoAccept}
                    onChange={(e) => setAutoAccept(e.target.checked)}
                  />
                  <div
                    className="w-10 h-5 rounded-full transition-colors"
                    style={{
                      background: autoAccept ? "var(--accent)" : "var(--border)",
                    }}
                  />
                  <div
                    className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform"
                    style={{
                      transform: autoAccept ? "translateX(20px)" : "translateX(0)",
                    }}
                  />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[color:var(--text-primary)]">
                    Auto-aceptar
                  </p>
                  <p className="text-[11px] text-[color:var(--text-muted)]">
                    La primera oferta válida se acepta automáticamente sin que tengas que intervenir.
                  </p>
                </div>
              </label>

              {/* Botón confirmar */}
              <button
                type="button"
                onClick={handleConfirm}
                disabled={available < 1 || createListing.isPending}
                className="w-full py-2.5 rounded-xl text-sm font-bold text-white transition-opacity disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, var(--accent), #a855f7)" }}
              >
                {createListing.isPending ? "Listando..." : "Confirmar listing"}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
