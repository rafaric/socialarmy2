"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeftRight } from "lucide-react";
import { toast } from "sonner";
import { useAcceptOffer } from "@/hooks/useMarket";
import RarityBadge from "./RarityBadge";
import type { TradeOffer, MarketListing, Card, Profile } from "@/types";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface TradeConfirmModalProps {
  offer: (TradeOffer & { offered_card: Card; buyer: Profile }) | null;
  listing: (MarketListing & { cards: Card }) | null;
  isOpen: boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export default function TradeConfirmModal({
  offer,
  listing,
  isOpen,
  onClose,
}: TradeConfirmModalProps) {
  const acceptOffer = useAcceptOffer();

  if (!offer || !listing) return null;

  async function handleConfirm() {
    if (!offer || !listing) return;

    try {
      await acceptOffer.mutateAsync({
        listingId: listing.id,
        offerId: offer.id,
      });
      toast.success("Intercambio realizado con éxito");
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al aceptar la oferta";
      toast.error(msg);
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="trade-confirm-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40"
            style={{ background: "rgba(0,0,0,0.65)" }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            key="trade-confirm-modal"
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="fixed bottom-0 left-0 right-0 z-50 sm:relative sm:inset-auto sm:mx-auto sm:mt-20 sm:max-w-sm"
          >
            <div className="glass-card rounded-t-2xl sm:rounded-2xl p-5 space-y-5">
              {/* Header */}
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-[color:var(--text-primary)]">
                  Confirmar intercambio
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

              {/* Comprador */}
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full overflow-hidden shrink-0 bg-purple-500/30">
                  {offer.buyer.avatar ? (
                    <Image
                      src={offer.buyer.avatar}
                      alt={offer.buyer.name}
                      width={24}
                      height={24}
                      className="object-cover w-full h-full"
                    />
                  ) : (
                    <span className="text-[10px] flex items-center justify-center w-full h-full text-[color:var(--text-secondary)]">
                      {offer.buyer.name?.[0] ?? "?"}
                    </span>
                  )}
                </div>
                <span className="text-xs text-[color:var(--text-muted)]">
                  Oferta de <strong className="text-[color:var(--text-primary)]">{offer.buyer.name}</strong>
                </span>
              </div>

              {/* Vista del intercambio */}
              <div className="flex items-center gap-3">
                {/* Carta que das (tu listing) */}
                <div className="flex-1 flex flex-col items-center gap-2">
                  <p className="text-[10px] text-[color:var(--text-muted)] font-semibold uppercase tracking-wide">
                    Das
                  </p>
                  <div className="relative w-full max-w-[100px] aspect-[3/4] rounded-xl overflow-hidden mx-auto">
                    {listing.cards.image_url ? (
                      <Image
                        src={listing.cards.image_url}
                        alt={listing.cards.name}
                        fill
                        sizes="100px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-2xl bg-purple-500/10">
                        💜
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] font-bold text-[color:var(--text-primary)] text-center truncate w-full">
                    {listing.cards.name}
                  </p>
                  <RarityBadge rarity={listing.cards.rarity} showPoints />
                </div>

                {/* Flecha */}
                <div
                  className="p-2 rounded-full shrink-0"
                  style={{ background: "var(--accent)20" }}
                >
                  <ArrowLeftRight className="w-4 h-4" style={{ color: "var(--accent)" }} />
                </div>

                {/* Carta que recibís (oferta del buyer) */}
                <div className="flex-1 flex flex-col items-center gap-2">
                  <p className="text-[10px] text-[color:var(--text-muted)] font-semibold uppercase tracking-wide">
                    Recibís
                  </p>
                  <div className="relative w-full max-w-[100px] aspect-[3/4] rounded-xl overflow-hidden mx-auto">
                    {offer.offered_card.image_url ? (
                      <Image
                        src={offer.offered_card.image_url}
                        alt={offer.offered_card.name}
                        fill
                        sizes="100px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-2xl bg-purple-500/10">
                        💜
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] font-bold text-[color:var(--text-primary)] text-center truncate w-full">
                    {offer.offered_card.name}
                  </p>
                  <RarityBadge rarity={offer.offered_card.rarity} showPoints />
                </div>
              </div>

              {/* Nota informativa */}
              <p className="text-[11px] text-[color:var(--text-muted)] text-center">
                Las demás ofertas pendientes serán rechazadas automáticamente.
              </p>

              {/* Botones */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-[color:var(--text-secondary)] transition-colors hover:bg-white/5"
                  style={{ border: "1px solid var(--glass-border)" }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={acceptOffer.isPending}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-opacity disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg, var(--accent), #a855f7)" }}
                >
                  {acceptOffer.isPending ? "Procesando..." : "Confirmar"}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
