"use client";

import { useState } from "react";
import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { useCancelOffer } from "@/hooks/useMarket";
import RarityBadge from "./RarityBadge";
import TradeConfirmModal from "./TradeConfirmModal";
import type { TradeOffer, MarketListing, Card, Profile } from "@/types";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface OfferCardProps {
  offer: TradeOffer & { offered_card: Card; buyer: Profile };
  listing: MarketListing & { cards: Card };
}

// ---------------------------------------------------------------------------
// Colores de borde por rareza (consistente con MarketCard)
// ---------------------------------------------------------------------------

const RARITY_BORDER: Record<string, string> = {
  common:    "rgba(156,163,175,0.20)",
  rare:      "rgba(96,165,250,0.20)",
  epic:      "rgba(168,85,247,0.20)",
  legendary: "rgba(245,158,11,0.30)",
};

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export default function OfferCard({ offer, listing }: OfferCardProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  const cancelOffer = useCancelOffer();

  const offeredCard = offer.offered_card;
  const buyer = offer.buyer;
  const borderColor = RARITY_BORDER[offeredCard.rarity] ?? "var(--glass-border)";

  const timeAgo = formatDistanceToNow(new Date(offer.created_at), {
    addSuffix: true,
    locale: es,
  });

  // Diferencia de puntos: ofrecido - requerido
  const requiredPoints = listing.cards.rarity_points;
  const offeredPoints = offeredCard.rarity_points;
  const surplus = offeredPoints - requiredPoints;

  // Estado resuelto: no mostrar botones de acción
  const isResolved = offer.status !== "pending";

  const STATUS_LABEL: Record<string, string> = {
    accepted: "Aceptada",
    rejected:  "Rechazada",
    cancelled: "Cancelada",
  };

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  // NOTA: el seller no tiene un endpoint explícito de "rechazar" una sola oferta.
  // Solo puede: aceptar (que rechaza el resto) o cancelar su listing (que rechaza todas).
  // El botón "Rechazar" llama useCancelOffer como si fuera el buyer, pero en la práctica
  // el seller solo puede ignorar/esperar que expire. Esta UX es provisional — si se
  // agrega un endpoint específico de seller-reject, reemplazar aquí.
  async function handleReject() {
    if (rejecting) return;
    setRejecting(true);

    try {
      await cancelOffer.mutateAsync({
        listingId: listing.id,
        offerId: offer.id,
      });
      toast.success("Oferta rechazada");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo rechazar la oferta";
      toast.error(msg);
    } finally {
      setRejecting(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      <div
        className="flex gap-3 rounded-xl p-3 transition-colors"
        style={{
          background: "var(--bg-surface)",
          border: `1px solid ${borderColor}`,
        }}
      >
        {/* Imagen de la carta ofrecida */}
        <div
          className="relative w-16 shrink-0 aspect-[3/4] rounded-lg overflow-hidden"
          style={{ border: `1px solid ${borderColor}` }}
        >
          {offeredCard.image_url ? (
            <Image
              src={offeredCard.image_url}
              alt={offeredCard.name}
              fill
              sizes="64px"
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xl bg-purple-500/10">
              💜
            </div>
          )}
        </div>

        {/* Datos de la oferta */}
        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
          {/* Nombre de la carta ofrecida */}
          <p className="text-xs font-bold text-[color:var(--text-primary)] truncate leading-tight">
            {offeredCard.name}
          </p>

          {/* Badge de rareza */}
          <RarityBadge rarity={offeredCard.rarity} showPoints />

          {/* Puntos ofrecidos vs requeridos */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-[color:var(--text-muted)]">
              {offeredPoints} pts ofrecidos
            </span>
            {surplus > 0 && (
              <span
                className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                style={{
                  background: "rgba(34,197,94,0.15)",
                  color: "#4ade80",
                }}
              >
                +{surplus} pts extra
              </span>
            )}
          </div>

          {/* Buyer info */}
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded-full overflow-hidden shrink-0 bg-purple-500/30">
              {buyer.avatar ? (
                <Image
                  src={buyer.avatar}
                  alt={buyer.name}
                  width={16}
                  height={16}
                  className="object-cover w-full h-full"
                />
              ) : (
                <span className="text-[8px] flex items-center justify-center w-full h-full text-[color:var(--text-secondary)]">
                  {buyer.name?.[0] ?? "?"}
                </span>
              )}
            </div>
            <span className="text-[10px] text-[color:var(--text-muted)] truncate">
              {buyer.name}
            </span>
            <span className="text-[9px] text-[color:var(--text-muted)] shrink-0">
              · {timeAgo}
            </span>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex flex-col gap-2 shrink-0 justify-center">
          {isResolved ? (
            <span
              className="text-[9px] font-semibold px-2 py-1 rounded-full text-center"
              style={{
                background:
                  offer.status === "accepted"
                    ? "rgba(34,197,94,0.15)"
                    : "rgba(156,163,175,0.15)",
                color:
                  offer.status === "accepted" ? "#4ade80" : "var(--text-muted)",
              }}
            >
              {STATUS_LABEL[offer.status] ?? offer.status}
            </span>
          ) : (
            <>
              {/* Botón Aceptar */}
              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                className="p-2 rounded-lg text-white transition-opacity hover:opacity-90"
                style={{ background: "linear-gradient(135deg, var(--accent), #a855f7)" }}
                aria-label="Aceptar oferta"
                title="Aceptar oferta"
              >
                <Check className="w-3.5 h-3.5" />
              </button>

              {/* Botón Rechazar (cancela la oferta) */}
              <button
                type="button"
                onClick={handleReject}
                disabled={rejecting || cancelOffer.isPending}
                className="p-2 rounded-lg transition-colors disabled:opacity-50"
                style={{
                  background: "rgba(239,68,68,0.12)",
                  color: "#f87171",
                  border: "1px solid rgba(239,68,68,0.20)",
                }}
                aria-label="Rechazar oferta"
                title="Rechazar oferta"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Modal de confirmación de aceptación */}
      <TradeConfirmModal
        offer={offer}
        listing={listing}
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
      />
    </>
  );
}
