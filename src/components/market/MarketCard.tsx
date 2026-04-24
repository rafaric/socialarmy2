"use client";

import Image from "next/image";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Heart } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import { useIsInWishlist, useToggleWishlist } from "@/hooks/useWishlist";
import RarityBadge from "./RarityBadge";
import type { MarketListing, Card, Profile } from "@/types";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface MarketCardProps {
  listing: MarketListing & { cards: Card; seller: Profile };
  onOffer?: (listing: MarketListing & { cards: Card; seller: Profile }) => void;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export default function MarketCard({ listing, onOffer }: MarketCardProps) {
  const { user } = useAuthStore();
  const isOwnListing = user === listing.seller_id;

  const isInWishlist = useIsInWishlist(listing.card_definition_id);
  const toggleWishlist = useToggleWishlist();

  const card = listing.cards;
  const seller = listing.seller;

  const timeLeft = formatDistanceToNow(new Date(listing.expires_at), {
    addSuffix: true,
    locale: es,
  });

  function handleWishlistToggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    toggleWishlist.mutate({
      cardDefinitionId: listing.card_definition_id,
      isInWishlist,
    });
  }

  function handleOffer(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    onOffer?.(listing);
  }

  // Color de borde por rareza
  const RARITY_BORDER: Record<string, string> = {
    common:    "rgba(156,163,175,0.25)",
    rare:      "rgba(96,165,250,0.25)",
    epic:      "rgba(168,85,247,0.25)",
    legendary: "rgba(245,158,11,0.35)",
  };
  const borderColor = RARITY_BORDER[card.rarity] ?? "var(--glass-border)";

  return (
    <Link
      href={`/market/${listing.id}`}
      className="group flex flex-col rounded-xl overflow-hidden transition-transform hover:scale-[1.01]"
      style={{
        background: "var(--bg-surface)",
        border: `1px solid ${borderColor}`,
        boxShadow: card.rarity === "legendary" ? `0 0 20px ${RARITY_BORDER.legendary}` : "var(--shadow-card)",
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
            style={{ background: `${borderColor}` }}
          >
            💜
          </div>
        )}

        {/* Badge auto-accept */}
        {listing.auto_accept && (
          <span className="absolute top-2 left-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-green-500/90 text-white">
            Auto
          </span>
        )}

        {/* Botón wishlist */}
        <button
          type="button"
          onClick={handleWishlistToggle}
          className="absolute top-2 right-2 p-1.5 rounded-full transition-all"
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

        {/* Indicador wishlist sobre la imagen */}
        {isInWishlist && (
          <span
            className="absolute bottom-2 left-2 text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
            style={{ background: "rgba(168,85,247,0.85)", color: "#fff" }}
          >
            En tu wishlist
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col gap-2">
        {/* Nombre y rareza */}
        <div>
          <p className="text-xs font-bold text-[color:var(--text-primary)] truncate leading-tight">
            {card.name}
          </p>
          <div className="mt-1">
            <RarityBadge rarity={card.rarity} showPoints />
          </div>
        </div>

        {/* Vendedor */}
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-full overflow-hidden shrink-0 bg-purple-500/30">
            {seller.avatar ? (
              <Image
                src={seller.avatar}
                alt={seller.name}
                width={16}
                height={16}
                className="object-cover w-full h-full"
              />
            ) : (
              <span className="text-[8px] flex items-center justify-center w-full h-full">
                {seller.name?.[0] ?? "?"}
              </span>
            )}
          </div>
          <span className="text-[10px] text-[color:var(--text-muted)] truncate">
            {seller.name}
          </span>
        </div>

        {/* Tiempo restante */}
        <p className="text-[10px] text-[color:var(--text-muted)]">
          Vence {timeLeft}
        </p>

        {/* CTA */}
        {isOwnListing ? (
          <span
            className="w-full py-1.5 text-center text-[11px] font-semibold rounded-lg"
            style={{ background: "var(--glass-bg)", color: "var(--text-secondary)" }}
          >
            Tu listing
          </span>
        ) : (
          <button
            type="button"
            onClick={handleOffer}
            className="w-full py-1.5 text-[11px] font-bold rounded-lg text-white transition-opacity hover:opacity-90"
            style={{ background: "linear-gradient(135deg, var(--accent), #a855f7)" }}
          >
            Ofrecer
          </button>
        )}
      </div>
    </Link>
  );
}
