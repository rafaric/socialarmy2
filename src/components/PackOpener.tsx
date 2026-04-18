"use client";

import { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { useOpenPack } from "@/hooks/usePacks";
import type { PendingPack, CardResult } from "@/hooks/usePacks";

const RARITY_CONFIG = {
  common:    { label: "Común",     color: "#9ca3af", glow: "rgba(156,163,175,0.4)" },
  rare:      { label: "Rara",      color: "#60a5fa", glow: "rgba(96,165,250,0.5)"  },
  epic:      { label: "Épica",     color: "#a855f7", glow: "rgba(168,85,247,0.6)"  },
  legendary: { label: "Legendaria",color: "#f59e0b", glow: "rgba(245,158,11,0.7)"  },
};

interface Props {
  pack: PendingPack;
  onDone: () => void;
}

export default function PackOpener({ pack, onDone }: Props) {
  const [phase, setPhase] = useState<"idle" | "opening" | "reveal">("idle");
  const [cards, setCards] = useState<CardResult[]>([]);
  const [revealed, setRevealed] = useState<number[]>([]);
  const openPack = useOpenPack();

  const isSuper = pack.pack_type === "super";

  async function handleOpen() {
    setPhase("opening");
    try {
      const result = await openPack.mutateAsync(pack.id);
      setCards(result);
      setTimeout(() => setPhase("reveal"), 800);
    } catch {
      setPhase("idle");
    }
  }

  function revealCard(i: number) {
    setRevealed((prev) => prev.includes(i) ? prev : [...prev, i]);
  }

  function revealAll() {
    setRevealed(cards.map((_, i) => i));
  }

  const allRevealed = cards.length > 0 && revealed.length === cards.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.85)" }}>
      <AnimatePresence mode="wait">
        {phase === "idle" && (
          <motion.div
            key="idle"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex flex-col items-center gap-6 text-center"
          >
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="relative"
            >
              <div
                className="w-40 h-56 rounded-2xl flex flex-col items-center justify-center gap-3 cursor-pointer select-none"
                style={{
                  background: isSuper
                    ? "linear-gradient(135deg, #7c3aed, #a855f7, #ec4899)"
                    : "linear-gradient(135deg, #1e1b4b, #312e81, #4c1d95)",
                  boxShadow: isSuper
                    ? "0 0 40px rgba(168,85,247,0.6), 0 0 80px rgba(168,85,247,0.3)"
                    : "0 0 20px rgba(124,58,237,0.4)",
                  border: "1px solid rgba(255,255,255,0.15)",
                }}
              >
                <span className="text-5xl">{isSuper ? "✨" : "💜"}</span>
                <span className="text-xs font-bold tracking-widest uppercase text-white/70">
                  {isSuper ? "Sobre Super" : "Sobre Simple"}
                </span>
              </div>
            </motion.div>

            <div>
              <p className="text-[color:var(--text-muted)] text-xs mb-1">Actividad: {pack.activity}</p>
              <p className="text-[color:var(--text-secondary)] text-sm">
                {isSuper ? "3 cartas — garantiza al menos 1 Rara" : "1 carta"}
              </p>
            </div>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleOpen}
              disabled={openPack.isPending}
              className="px-8 py-3 rounded-xl font-bold text-sm text-white disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, var(--accent), #a855f7)" }}
            >
              ¡Abrir sobre!
            </motion.button>
          </motion.div>
        )}

        {phase === "opening" && (
          <motion.div
            key="opening"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-4"
          >
            <motion.div
              animate={{ rotate: 360, scale: [1, 1.2, 1] }}
              transition={{ duration: 0.8, ease: "easeInOut" }}
              className="text-6xl"
            >
              ✨
            </motion.div>
            <p className="text-[color:var(--text-secondary)] text-sm">Abriendo...</p>
          </motion.div>
        )}

        {phase === "reveal" && (
          <motion.div
            key="reveal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-6 w-full max-w-sm"
          >
            <p className="text-xs text-[color:var(--text-muted)] uppercase tracking-widest">
              {allRevealed ? "¡Tus nuevas cartas!" : "Tocá para revelar"}
            </p>

            <div className={`flex gap-3 justify-center flex-wrap`}>
              {cards.map((card, i) => {
                const cfg = RARITY_CONFIG[card.rarity];
                const isRevealed = revealed.includes(i);
                return (
                  <motion.div
                    key={card.id}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.15 }}
                    onClick={() => revealCard(i)}
                    className="cursor-pointer"
                    style={{ width: 120 }}
                  >
                    <motion.div
                      animate={{ rotateY: isRevealed ? 0 : 180 }}
                      transition={{ duration: 0.5, type: "spring" }}
                      style={{ transformStyle: "preserve-3d", position: "relative", height: 168 }}
                    >
                      {/* Frente (carta) */}
                      <div
                        className="absolute inset-0 rounded-xl overflow-hidden flex flex-col"
                        style={{
                          backfaceVisibility: "hidden",
                          boxShadow: isRevealed ? `0 0 20px ${cfg.glow}, 0 0 40px ${cfg.glow}` : "none",
                          border: `1px solid ${cfg.color}60`,
                          background: "var(--bg-surface)",
                          transition: "box-shadow 0.3s",
                        }}
                      >
                        <div className="flex-1 relative">
                          {card.image_url ? (
                            <Image src={card.image_url} alt={card.name} fill sizes="120px" className="object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-3xl" style={{ background: `${cfg.color}15` }}>
                              💜
                            </div>
                          )}
                        </div>
                        <div className="p-1.5 text-center" style={{ background: `${cfg.color}15` }}>
                          <p className="text-[10px] font-bold truncate" style={{ color: cfg.color }}>{cfg.label}</p>
                          <p className="text-[9px] text-[color:var(--text-muted)] truncate">{card.name}</p>
                        </div>
                      </div>

                      {/* Dorso */}
                      <div
                        className="absolute inset-0 rounded-xl flex items-center justify-center"
                        style={{
                          backfaceVisibility: "hidden",
                          transform: "rotateY(180deg)",
                          background: "linear-gradient(135deg, #1e1b4b, #312e81)",
                          border: "1px solid rgba(255,255,255,0.1)",
                        }}
                      >
                        <span className="text-4xl">💜</span>
                      </div>
                    </motion.div>
                  </motion.div>
                );
              })}
            </div>

            <div className="flex gap-3">
              {!allRevealed && (
                <button
                  type="button"
                  onClick={revealAll}
                  className="px-4 py-2 rounded-xl text-xs text-[color:var(--text-secondary)] hover:bg-white/10 transition-colors"
                >
                  Revelar todo
                </button>
              )}
              {allRevealed && (
                <motion.button
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  type="button"
                  onClick={onDone}
                  className="px-6 py-2.5 rounded-xl font-bold text-sm text-white"
                  style={{ background: "linear-gradient(135deg, var(--accent), #a855f7)" }}
                >
                  ¡Genial!
                </motion.button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
