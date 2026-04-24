"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePendingPacks } from "@/hooks/usePacks";
import { useInventory } from "@/hooks/useInventory";
import PackOpener from "@/components/PackOpener";
import CollectionOnboarding from "@/components/CollectionOnboarding";
import CollectionGrid from "@/components/collection/CollectionGrid";
import ListingModal from "@/components/market/ListingModal";
import type { UserCard, Card, CardRarity } from "@/types";
import type { PendingPack } from "@/hooks/usePacks";

// ---------------------------------------------------------------------------
// Config de rareza
// ---------------------------------------------------------------------------

const RARITY_CONFIG: Record<CardRarity, { label: string; color: string; bg: string }> = {
  common:    { label: "Común",      color: "#9ca3af", bg: "rgba(156,163,175,0.1)" },
  rare:      { label: "Rara",       color: "#60a5fa", bg: "rgba(96,165,250,0.1)"  },
  epic:      { label: "Épica",      color: "#a855f7", bg: "rgba(168,85,247,0.1)"  },
  legendary: { label: "Legendaria", color: "#f59e0b", bg: "rgba(245,158,11,0.1)"  },
};

const RARITY_ORDER: CardRarity[] = ["legendary", "epic", "rare", "common"];

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------

export default function CollectionPage() {
  const { data: packs = [] } = usePendingPacks();
  const { data: inventory = [], isLoading } = useInventory();
  const [openingPack, setOpeningPack] = useState<PendingPack | null>(null);
  const [filter, setFilter] = useState<string>("all");

  // Modal de listing
  const [listingCard, setListingCard] = useState<(UserCard & { cards: Card }) | null>(null);

  // Filtrar solo cartas que tienen el join de cards resuelto
  const collection = inventory.filter(
    (uc): uc is UserCard & { cards: Card } => !!uc.cards
  );

  // Ordenar por rareza (según RARITY_ORDER) y luego disponibilidad
  const sorted = [...collection].sort(
    (a, b) =>
      RARITY_ORDER.indexOf(a.cards.rarity) -
      RARITY_ORDER.indexOf(b.cards.rarity)
  );

  const filtered =
    filter === "all"
      ? sorted
      : sorted.filter((uc) => uc.cards.rarity === filter);

  // Stats por rareza — cuenta cartas únicas (no instancias)
  const counts = collection.reduce<Record<string, number>>((acc, uc) => {
    acc[uc.cards.rarity] = (acc[uc.cards.rarity] ?? 0) + 1;
    return acc;
  }, {});

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[color:var(--text-primary)]">
            Mi Colección
          </h1>
          <p className="text-sm text-[color:var(--text-muted)] mt-0.5">
            {collection.length} fotocards
          </p>
        </div>

        {packs.length > 0 && (
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <button
              type="button"
              onClick={() => setOpeningPack(packs[0])}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white"
              style={{
                background: "linear-gradient(135deg, var(--accent), #a855f7)",
              }}
            >
              ✨ {packs.length} sobre{packs.length > 1 ? "s" : ""} sin abrir
            </button>
          </motion.div>
        )}
      </div>

      {/* Filtros de rareza */}
      <div className="grid grid-cols-4 gap-2">
        {RARITY_ORDER.map((r) => {
          const cfg = RARITY_CONFIG[r];
          return (
            <button
              key={r}
              type="button"
              onClick={() => setFilter(filter === r ? "all" : r)}
              className="glass-card p-3 text-center transition-all"
              style={{
                border:
                  filter === r
                    ? `1px solid ${cfg.color}`
                    : "1px solid transparent",
                background: filter === r ? cfg.bg : undefined,
              }}
            >
              <p className="text-lg font-bold" style={{ color: cfg.color }}>
                {counts[r] ?? 0}
              </p>
              <p className="text-[10px] text-[color:var(--text-muted)]">
                {cfg.label}
              </p>
            </button>
          );
        })}
      </div>

      {/* Grid / skeleton / empty */}
      {isLoading ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton aspect-[3/4] rounded-xl" />
          ))}
        </div>
      ) : collection.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <p className="text-4xl mb-3">💜</p>
          <p className="text-[color:var(--text-muted)] text-sm">
            Todavía no tenés cartas. ¡Hacé actividades para ganar sobres!
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <p className="text-4xl mb-3">💜</p>
          <p className="text-[color:var(--text-muted)] text-sm">
            No hay cartas de esa rareza aún.
          </p>
        </div>
      ) : (
        <CollectionGrid
          cards={filtered}
          marketDropZone={true}
          onListCard={(card) => setListingCard(card)}
        />
      )}

      <CollectionOnboarding />

      {/* Pack opener modal */}
      <AnimatePresence>
        {openingPack && (
          <PackOpener
            pack={openingPack}
            onDone={() => setOpeningPack(packs.length > 1 ? packs[1] : null)}
          />
        )}
      </AnimatePresence>

      {/* Listing modal — se abre al drag o al botón "Listar" en cada carta */}
      <ListingModal
        card={listingCard}
        open={listingCard !== null}
        onClose={() => setListingCard(null)}
      />
    </div>
  );
}
