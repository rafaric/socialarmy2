"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronDown, ChevronUp, ShoppingBag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  useMyListings,
  useListingOffers,
  useCancelListing,
} from "@/hooks/useMarket";
import TradeConfirmModal from "@/components/market/TradeConfirmModal";
import OfferCard from "@/components/market/OfferCard";
import RarityBadge from "@/components/market/RarityBadge";
import type { MarketListing, TradeOffer, Card, Profile } from "@/types";

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
// Sub-componente: row de un listing con sus ofertas expandibles
// ---------------------------------------------------------------------------

interface ListingRowProps {
  listing: MarketListing & { cards: Card };
}

function ListingRow({ listing }: ListingRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [confirmOffer, setConfirmOffer] = useState<
    (TradeOffer & { offered_card: Card; buyer: Profile }) | null
  >(null);

  const cancelListing = useCancelListing();
  const { data: offers, isLoading: offersLoading } = useListingOffers(
    expanded ? listing.id : ""
  );

  const card = listing.cards;
  const borderColor = RARITY_BORDER[card.rarity] ?? "var(--glass-border)";

  const timeLeft = formatDistanceToNow(new Date(listing.expires_at), {
    addSuffix: true,
    locale: es,
  });

  const pendingOffers = (offers ?? []).filter((o) => o.status === "pending");

  async function handleCancelListing() {
    const confirmed = window.confirm(
      `¿Cancelar el listing de "${card.name}"? Las ofertas pendientes serán rechazadas.`
    );
    if (!confirmed) return;

    try {
      await cancelListing.mutateAsync({ id: listing.id });
      toast.success("Listing cancelado");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo cancelar el listing";
      toast.error(msg);
    }
  }

  // Calcular si tiene offers enriquecidas con los datos necesarios para OfferCard y TradeConfirmModal
  const enrichedOffers = (offers ?? []).filter(
    (o): o is TradeOffer & { offered_card: Card; buyer: Profile } =>
      !!o.offered_card && !!o.buyer
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: "var(--bg-surface)",
          border: `1px solid ${borderColor}`,
          boxShadow:
            card.rarity === "legendary"
              ? `0 0 16px ${RARITY_BORDER.legendary}`
              : "var(--shadow-card)",
        }}
      >
        {/* Fila principal del listing */}
        <div className="flex gap-3 p-3">
          {/* Imagen de la carta */}
          <div
            className="relative w-14 shrink-0 aspect-[3/4] rounded-lg overflow-hidden"
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

          {/* Datos del listing */}
          <div className="flex-1 min-w-0 flex flex-col gap-1">
            <p className="text-xs font-bold text-[color:var(--text-primary)] truncate leading-tight">
              {card.name}
            </p>

            <RarityBadge rarity={card.rarity} showPoints />

            {/* Badges de estado */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {listing.auto_accept && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400">
                  Auto-accept
                </span>
              )}
              <span className="text-[10px] text-[color:var(--text-muted)]">
                Vence {timeLeft}
              </span>
            </div>

            {/* Contador de ofertas pendientes */}
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-1 text-[10px] font-semibold transition-colors mt-0.5 w-fit"
              style={{ color: pendingOffers.length > 0 ? "var(--accent)" : "var(--text-muted)" }}
            >
              {pendingOffers.length > 0
                ? `${pendingOffers.length} oferta${pendingOffers.length !== 1 ? "s" : ""} pendiente${pendingOffers.length !== 1 ? "s" : ""}`
                : "Sin ofertas aún"}
              {expanded ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </button>
          </div>

          {/* Botón cancelar listing */}
          <div className="flex items-start shrink-0">
            <button
              type="button"
              onClick={handleCancelListing}
              disabled={cancelListing.isPending}
              className="p-2 rounded-lg transition-colors disabled:opacity-50"
              style={{
                background: "rgba(239,68,68,0.10)",
                color: "#f87171",
                border: "1px solid rgba(239,68,68,0.18)",
              }}
              aria-label="Cancelar listing"
              title="Cancelar listing"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Sección expandible: lista de ofertas */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              key={`offers-${listing.id}`}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div
                className="px-3 pb-3 pt-1 space-y-2"
                style={{ borderTop: "1px solid var(--glass-border)" }}
              >
                {offersLoading && (
                  <div className="space-y-2 pt-1">
                    {[1, 2].map((i) => (
                      <div
                        key={i}
                        className="h-16 rounded-lg animate-pulse"
                        style={{ background: "var(--glass-bg)" }}
                      />
                    ))}
                  </div>
                )}

                {!offersLoading && enrichedOffers.length === 0 && (
                  <p className="text-[11px] text-[color:var(--text-muted)] text-center py-3">
                    No hay ofertas todavía
                  </p>
                )}

                {!offersLoading &&
                  enrichedOffers.map((offer) => (
                    <OfferCard
                      key={offer.id}
                      offer={offer}
                      listing={listing}
                    />
                  ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* TradeConfirmModal para aceptar una oferta desde OfferCard */}
      {/* OfferCard maneja su propio modal internamente — esto es un fallback de nivel página */}
      <TradeConfirmModal
        offer={confirmOffer}
        listing={listing}
        isOpen={confirmOffer !== null}
        onClose={() => setConfirmOffer(null)}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Página principal
// ---------------------------------------------------------------------------

export default function MyListingsPage() {
  const { data: listings, isLoading, isError } = useMyListings();

  const activeListings = ((listings ?? []) as (MarketListing & { cards: Card })[]).filter(
    (l) => l.status === "active"
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="glass-card p-5">
        <div className="flex items-center gap-3 mb-1">
          <ShoppingBag className="w-5 h-5" style={{ color: "var(--accent)" }} />
          <h1 className="text-lg font-bold text-[color:var(--text-primary)]">
            Mis listings
          </h1>
        </div>
        <p className="text-xs text-[color:var(--text-muted)]">
          Tus cartas activas en el mercado y las ofertas recibidas
        </p>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-xl overflow-hidden animate-pulse"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--glass-border)" }}
            >
              <div className="flex gap-3 p-3">
                <div className="w-14 aspect-[3/4] rounded-lg bg-white/5 shrink-0" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-3 bg-white/5 rounded w-2/3" />
                  <div className="h-3 bg-white/5 rounded w-1/3" />
                  <div className="h-3 bg-white/5 rounded w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="glass-card p-8 text-center">
          <p className="text-[color:var(--text-muted)] text-sm">
            Error al cargar tus listings. Intentá de nuevo.
          </p>
        </div>
      )}

      {/* Estado vacío */}
      {!isLoading && !isError && activeListings.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-12 text-center space-y-4"
        >
          <p className="text-4xl">📦</p>
          <div>
            <p className="text-[color:var(--text-primary)] font-semibold mb-1">
              No tenés listings activos
            </p>
            <p className="text-[color:var(--text-muted)] text-sm">
              Listá una carta desde tu colección para empezar a intercambiar.
            </p>
          </div>
          <Link
            href="/market"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-90"
            style={{ background: "linear-gradient(135deg, var(--accent), #a855f7)" }}
          >
            Ir al mercado
          </Link>
        </motion.div>
      )}

      {/* Lista de listings activos */}
      {!isLoading && !isError && activeListings.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-3"
        >
          {activeListings.map((listing) => (
            <ListingRow key={listing.id} listing={listing} />
          ))}
        </motion.div>
      )}
    </div>
  );
}
