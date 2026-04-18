"use client";

import { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthStore } from "@/store/useAuthStore";
import { usePendingPacks, useCollection } from "@/hooks/usePacks";
import PackOpener from "@/components/PackOpener";
import type { PendingPack } from "@/hooks/usePacks";

const RARITY_CONFIG = {
  common:    { label: "Común",      color: "#9ca3af", bg: "rgba(156,163,175,0.1)"  },
  rare:      { label: "Rara",       color: "#60a5fa", bg: "rgba(96,165,250,0.1)"   },
  epic:      { label: "Épica",      color: "#a855f7", bg: "rgba(168,85,247,0.1)"   },
  legendary: { label: "Legendaria", color: "#f59e0b", bg: "rgba(245,158,11,0.1)"   },
};

const RARITY_ORDER = ["legendary", "epic", "rare", "common"];

export default function CollectionPage() {
  const { user } = useAuthStore();
  const { data: packs = [] } = usePendingPacks();
  const { data: collection = [], isLoading } = useCollection(user);
  const [openingPack, setOpeningPack] = useState<PendingPack | null>(null);
  const [filter, setFilter] = useState<string>("all");

  const sorted = [...collection].sort((a, b) =>
    RARITY_ORDER.indexOf(a.cards.rarity) - RARITY_ORDER.indexOf(b.cards.rarity)
  );

  const filtered = filter === "all" ? sorted : sorted.filter((uc) => uc.cards.rarity === filter);

  const counts = collection.reduce<Record<string, number>>((acc, uc) => {
    acc[uc.cards.rarity] = (acc[uc.cards.rarity] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[color:var(--text-primary)]">Mi Colección</h1>
          <p className="text-sm text-[color:var(--text-muted)] mt-0.5">{collection.length} fotocards</p>
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
              style={{ background: "linear-gradient(135deg, var(--accent), #a855f7)" }}
            >
              ✨ {packs.length} sobre{packs.length > 1 ? "s" : ""} sin abrir
            </button>
          </motion.div>
        )}
      </div>

      {/* Rarity stats */}
      <div className="grid grid-cols-4 gap-2">
        {RARITY_ORDER.map((r) => {
          const cfg = RARITY_CONFIG[r as keyof typeof RARITY_CONFIG];
          return (
            <button
              key={r}
              type="button"
              onClick={() => setFilter(filter === r ? "all" : r)}
              className="glass-card p-3 text-center transition-all"
              style={{
                border: filter === r ? `1px solid ${cfg.color}` : "1px solid transparent",
                background: filter === r ? cfg.bg : undefined,
              }}
            >
              <p className="text-lg font-bold" style={{ color: cfg.color }}>{counts[r] ?? 0}</p>
              <p className="text-[10px] text-[color:var(--text-muted)]">{cfg.label}</p>
            </button>
          );
        })}
      </div>

      {/* Grid de cartas */}
      {isLoading ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton aspect-[3/4] rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <p className="text-4xl mb-3">💜</p>
          <p className="text-[color:var(--text-muted)] text-sm">
            {collection.length === 0
              ? "Todavía no tenés cartas. ¡Hacé actividades para ganar sobres!"
              : "No hay cartas de esa rareza aún."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          <AnimatePresence>
            {filtered.map((uc, i) => {
              const cfg = RARITY_CONFIG[uc.cards.rarity as keyof typeof RARITY_CONFIG];
              return (
                <motion.div
                  key={uc.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="rounded-xl overflow-hidden flex flex-col"
                  style={{
                    border: `1px solid ${cfg.color}40`,
                    background: "var(--bg-surface)",
                    boxShadow: uc.cards.rarity === "legendary" ? `0 0 16px ${cfg.color}40` : undefined,
                  }}
                >
                  <div className="relative aspect-[3/4]">
                    {uc.cards.image_url ? (
                      <Image
                        src={uc.cards.image_url}
                        alt={uc.cards.name}
                        fill
                        sizes="(max-width: 640px) 33vw, 25vw"
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-3xl" style={{ background: `${cfg.color}10` }}>
                        💜
                      </div>
                    )}
                  </div>
                  <div className="p-2 text-center" style={{ background: `${cfg.color}10` }}>
                    <p className="text-[10px] font-bold" style={{ color: cfg.color }}>{cfg.label}</p>
                    <p className="text-[9px] text-[color:var(--text-muted)] truncate">{uc.cards.name}</p>
                    {uc.for_trade && (
                      <span className="text-[8px] px-1 py-0.5 rounded mt-0.5 inline-block" style={{ background: "var(--accent)20", color: "var(--accent)" }}>
                        En trade
                      </span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Pack opener modal */}
      <AnimatePresence>
        {openingPack && (
          <PackOpener
            pack={openingPack}
            onDone={() => setOpeningPack(packs.length > 1 ? packs[1] : null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
