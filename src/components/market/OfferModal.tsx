"use client";

import { useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { useInventory } from "@/hooks/useInventory";
import { useCreateOffer } from "@/hooks/useMarket";
import RarityBadge from "./RarityBadge";
import type { MarketListing, Card, UserCard } from "@/types";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface OfferModalProps {
  listing: (MarketListing & { cards: Card }) | null;
  isOpen: boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export default function OfferModal({ listing, isOpen, onClose }: OfferModalProps) {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const { data: inventory = [] } = useInventory();
  const createOffer = useCreateOffer();

  if (!listing) return null;

  const minPoints = listing.cards.rarity_points;

  // Filtrar inventario: disponibles Y con puntos suficientes
  const eligibleCards = (inventory as (UserCard & { cards: Card })[]).filter(
    (uc) =>
      uc.cards &&
      uc.quantity - uc.locked_quantity >= 1 &&
      uc.cards.rarity_points >= minPoints
  );

  const selectedCard = eligibleCards.find(
    (uc) => uc.card_definition_id === selectedCardId
  );

  async function handleConfirm() {
    if (!listing || !selectedCardId) return;

    try {
      await createOffer.mutateAsync({
        listingId: listing.id,
        offered_card_id: selectedCardId,
      });
      toast.success("Oferta enviada");
      setSelectedCardId(null);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al enviar la oferta";
      toast.error(msg);
    }
  }

  function handleClose() {
    setSelectedCardId(null);
    onClose();
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="offer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40"
            style={{ background: "rgba(0,0,0,0.65)" }}
            onClick={handleClose}
          />

          {/* Modal */}
          <motion.div
            key="offer-modal"
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="fixed bottom-0 left-0 right-0 z-50 max-h-[90vh] overflow-y-auto sm:relative sm:inset-auto sm:mx-auto sm:mt-20 sm:max-w-md"
          >
            <div className="glass-card rounded-t-2xl sm:rounded-2xl p-5 space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-[color:var(--text-primary)]">
                  Hacer una oferta
                </h2>
                <button
                  type="button"
                  onClick={handleClose}
                  className="text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)] transition-colors text-lg leading-none"
                  aria-label="Cerrar"
                >
                  ✕
                </button>
              </div>

              {/* Carta en el mercado */}
              <div
                className="flex gap-3 items-center p-3 rounded-xl"
                style={{ background: "var(--bg-surface)" }}
              >
                <div className="relative w-14 shrink-0 rounded-lg overflow-hidden aspect-[3/4]">
                  {listing.cards.image_url ? (
                    <Image
                      src={listing.cards.image_url}
                      alt={listing.cards.name}
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
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[color:var(--text-primary)]">
                    Te llevarías:
                  </p>
                  <p className="text-sm font-bold text-[color:var(--text-primary)] truncate">
                    {listing.cards.name}
                  </p>
                  <RarityBadge rarity={listing.cards.rarity} showPoints className="mt-1" />
                </div>
              </div>

              {/* Puntos requeridos */}
              <p className="text-xs text-[color:var(--text-muted)] text-center">
                Necesitás ofrecer una carta de al menos{" "}
                <strong className="text-[color:var(--text-primary)]">{minPoints} pts</strong>
              </p>

              {/* Selección de carta */}
              <div>
                <p className="text-xs font-semibold text-[color:var(--text-secondary)] mb-2">
                  Seleccioná tu carta ({eligibleCards.length} disponibles)
                </p>

                {eligibleCards.length === 0 ? (
                  <div className="p-4 rounded-xl text-center" style={{ background: "var(--bg-surface)" }}>
                    <p className="text-sm text-[color:var(--text-muted)]">
                      No tenés cartas con suficientes puntos disponibles.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                    {eligibleCards.map((uc) => {
                      const isSelected = uc.card_definition_id === selectedCardId;
                      return (
                        <button
                          key={uc.card_definition_id}
                          type="button"
                          onClick={() => setSelectedCardId(uc.card_definition_id)}
                          className="rounded-xl overflow-hidden flex flex-col transition-all"
                          style={{
                            border: isSelected
                              ? "2px solid var(--accent)"
                              : "1px solid var(--glass-border)",
                            background: isSelected ? "var(--accent)15" : "var(--bg-surface)",
                            boxShadow: isSelected ? "0 0 12px var(--accent-glow)" : "none",
                          }}
                        >
                          <div className="relative aspect-[3/4]">
                            {uc.cards.image_url ? (
                              <Image
                                src={uc.cards.image_url}
                                alt={uc.cards.name}
                                fill
                                sizes="80px"
                                className="object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-2xl bg-purple-500/10">
                                💜
                              </div>
                            )}
                            <span
                              className="absolute top-0.5 right-0.5 text-[8px] px-1 py-0 rounded font-bold"
                              style={{ background: "rgba(0,0,0,0.7)", color: "#fff" }}
                            >
                              x{uc.quantity - uc.locked_quantity}
                            </span>
                          </div>
                          <div className="p-1 text-center">
                            <p className="text-[8px] font-bold text-[color:var(--text-muted)] truncate">
                              {uc.cards.name}
                            </p>
                            <p className="text-[8px] text-[color:var(--text-muted)]">
                              {uc.cards.rarity_points} pts
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Comparación de puntos */}
              {selectedCard && (
                <div
                  className="flex items-center justify-between p-3 rounded-xl text-xs"
                  style={{ background: "var(--bg-surface)" }}
                >
                  <span className="text-[color:var(--text-muted)]">
                    Tu carta: <strong className="text-[color:var(--text-primary)]">{selectedCard.cards.rarity_points} pts</strong>
                  </span>
                  <span className="text-[color:var(--text-muted)]">
                    Requerido: <strong className="text-[color:var(--text-primary)]">{minPoints} pts</strong>
                  </span>
                  <span
                    className="font-semibold"
                    style={{
                      color: selectedCard.cards.rarity_points >= minPoints ? "#22c55e" : "#ef4444",
                    }}
                  >
                    {selectedCard.cards.rarity_points >= minPoints ? "OK" : "Insuficiente"}
                  </span>
                </div>
              )}

              {/* Botón confirmar */}
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!selectedCardId || createOffer.isPending}
                className="w-full py-2.5 rounded-xl text-sm font-bold text-white transition-opacity disabled:opacity-40"
                style={{ background: "linear-gradient(135deg, var(--accent), #a855f7)" }}
              >
                {createOffer.isPending ? "Enviando..." : "Confirmar oferta"}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
