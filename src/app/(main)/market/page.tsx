"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ShoppingBag, List, Heart, History } from "lucide-react";
import { useMarketListings } from "@/hooks/useMarket";
import MarketCard from "@/components/market/MarketCard";
import OfferModal from "@/components/market/OfferModal";
import type { CardRarity, MarketListing, Card, Profile } from "@/types";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

type RarityFilter = CardRarity | "all";

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export default function MarketPage() {
  const [rarityFilter, setRarityFilter] = useState<RarityFilter>("all");
  const [selectedListing, setSelectedListing] = useState<
    (MarketListing & { cards: Card; seller: Profile }) | null
  >(null);

  const { data, isLoading, isError } = useMarketListings(
    rarityFilter !== "all" ? { rarity: rarityFilter } : undefined
  );

  const listings = (data?.listings ?? []) as (MarketListing & {
    cards: Card;
    seller: Profile;
  })[];

  // ---------------------------------------------------------------------------
  // Filtros de rareza
  // ---------------------------------------------------------------------------
  const RARITY_TABS: { value: RarityFilter; label: string }[] = [
    { value: "all",       label: "Todas"      },
    { value: "legendary", label: "Legendaria" },
    { value: "epic",      label: "Épica"      },
    { value: "rare",      label: "Rara"       },
    { value: "common",    label: "Común"      },
  ];

  const RARITY_COLOR: Record<CardRarity, string> = {
    common:    "#9ca3af",
    rare:      "#60a5fa",
    epic:      "#a855f7",
    legendary: "#f59e0b",
  };

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
            Mercado
          </h1>
        </div>
        <p className="text-xs text-[color:var(--text-muted)]">
          Intercambiá fotocards con otros fans de BTS
        </p>
      </div>

      {/* Tabs de navegación de trading */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {/* Tab activo: Mercado */}
        <span
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
          style={{
            background: "rgba(var(--accent-rgb,124,77,206),0.15)",
            border: "1px solid var(--accent)",
            color: "var(--accent)",
          }}
        >
          <ShoppingBag className="w-3 h-3" />
          Mercado
        </span>
        <Link
          href="/market/my-listings"
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all hover:opacity-80"
          style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)", color: "var(--text-secondary)" }}
        >
          <List className="w-3 h-3" />
          Mis listings
        </Link>
        <Link
          href="/wishlist"
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all hover:opacity-80"
          style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)", color: "var(--text-secondary)" }}
        >
          <Heart className="w-3 h-3" />
          Mi wishlist
        </Link>
        <Link
          href="/market/history"
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all hover:opacity-80"
          style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)", color: "var(--text-secondary)" }}
        >
          <History className="w-3 h-3" />
          Historial
        </Link>
      </div>

      {/* Filtros de rareza */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {RARITY_TABS.map((tab) => {
          const isActive = rarityFilter === tab.value;
          const accentColor =
            tab.value !== "all"
              ? RARITY_COLOR[tab.value as CardRarity]
              : "var(--accent)";

          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setRarityFilter(tab.value)}
              className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={{
                background: isActive ? `${accentColor}25` : "var(--glass-bg)",
                border: `1px solid ${isActive ? accentColor : "var(--glass-border)"}`,
                color: isActive ? accentColor : "var(--text-secondary)",
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Contenido principal */}
      {isLoading && (
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
                <div className="h-6 bg-white/5 rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {isError && (
        <div className="glass-card p-8 text-center">
          <p className="text-[color:var(--text-muted)] text-sm">
            Error al cargar el mercado. Intentá de nuevo.
          </p>
        </div>
      )}

      {!isLoading && !isError && listings.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-12 text-center"
        >
          <p className="text-4xl mb-3">🛒</p>
          <p className="text-[color:var(--text-primary)] font-semibold mb-1">
            No hay cartas en el mercado
          </p>
          <p className="text-[color:var(--text-muted)] text-sm">
            {rarityFilter !== "all"
              ? "Probá con otro filtro de rareza."
              : "Sé el primero en listar una carta."}
          </p>
        </motion.div>
      )}

      {!isLoading && !isError && listings.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid grid-cols-2 sm:grid-cols-3 gap-3"
        >
          {listings.map((listing) => (
            <MarketCard
              key={listing.id}
              listing={listing}
              onOffer={setSelectedListing}
            />
          ))}
        </motion.div>
      )}

      {/* TODO Fase 5 — habilitar Realtime en trade_offers en Supabase dashboard */}

      {/* Modal de oferta */}
      <OfferModal
        listing={selectedListing}
        isOpen={selectedListing !== null}
        onClose={() => setSelectedListing(null)}
      />
    </div>
  );
}
