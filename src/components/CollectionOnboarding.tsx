"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const STORAGE_KEY = "army_collection_onboarded";

const ACTIVITIES = [
  { icon: "📝", label: "Publicar un post", reward: "Sobre Super", sub: "3 cartas · garantiza al menos 1 Rara" },
  { icon: "💜", label: "Reaccionar a un post", reward: "Sobre Simple", sub: "1 carta · máx. 5 por día" },
  { icon: "💬", label: "Comentar en un post", reward: "Sobre Simple", sub: "1 carta · máx. 5 por día" },
  { icon: "🔥", label: "5 días seguidos de login", reward: "Sobre Super", sub: "3 cartas · garantiza al menos 1 Rara" },
];

const RARITIES = [
  { color: "#f59e0b", glow: "rgba(245,158,11,0.3)", label: "Legendaria", pct: "3%", icon: "👑" },
  { color: "#a855f7", glow: "rgba(168,85,247,0.2)", label: "Épica",      pct: "14%", icon: "✨" },
  { color: "#60a5fa", glow: "rgba(96,165,250,0.2)", label: "Rara",       pct: "28%", icon: "⭐" },
  { color: "#9ca3af", glow: "transparent",           label: "Común",     pct: "55%", icon: "💜" },
];

export default function CollectionOnboarding() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && !localStorage.getItem(STORAGE_KEY)) {
      setOpen(true);
    }
  }, []);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, "1");
    setOpen(false);
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.75)" }}
          onClick={(e) => e.target === e.currentTarget && dismiss()}
        >
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ type: "spring", damping: 22 }}
            className="glass-card w-full max-w-sm rounded-2xl overflow-hidden"
          >
            {/* Header */}
            <div
              className="px-5 pt-5 pb-4 text-center"
              style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.15), rgba(168,85,247,0.1))" }}
            >
              <p className="text-3xl mb-1">✨</p>
              <h2 className="text-lg font-bold text-[color:var(--text-primary)]">Sistema de Coleccionables</h2>
              <p className="text-xs text-[color:var(--text-muted)] mt-1">
                Ganá sobres haciendo actividades y coleccioná fotocards de cada era de BTS.
              </p>
            </div>

            <div className="px-5 py-4 space-y-4">
              {/* Actividades */}
              <div>
                <p className="text-[10px] font-bold tracking-widest uppercase text-[color:var(--text-muted)] mb-2">
                  ¿Cómo ganás sobres?
                </p>
                <div className="space-y-1.5">
                  {ACTIVITIES.map((a) => (
                    <div key={a.label} className="flex items-center gap-3">
                      <span className="text-lg w-7 text-center">{a.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-[color:var(--text-primary)] leading-tight">{a.label}</p>
                        <p className="text-[10px] text-[color:var(--text-muted)]">{a.sub}</p>
                      </div>
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
                        style={{ background: "rgba(168,85,247,0.15)", color: "#a855f7" }}
                      >
                        {a.reward}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Rarezas */}
              <div>
                <p className="text-[10px] font-bold tracking-widest uppercase text-[color:var(--text-muted)] mb-2">
                  Rarezas
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {RARITIES.map((r) => (
                    <div
                      key={r.label}
                      className="rounded-xl p-2 text-center"
                      style={{
                        background: `rgba(${r.color.slice(1).match(/../g)!.map(x => parseInt(x, 16)).join(",")}, 0.08)`,
                        border: `1px solid ${r.color}40`,
                        boxShadow: r.glow !== "transparent" ? `0 0 10px ${r.glow}` : undefined,
                      }}
                    >
                      <p className="text-base">{r.icon}</p>
                      <p className="text-[9px] font-bold mt-0.5" style={{ color: r.color }}>{r.label}</p>
                      <p className="text-[9px] text-[color:var(--text-muted)]">{r.pct}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* CTA */}
            <div className="px-5 pb-5">
              <button
                type="button"
                onClick={dismiss}
                className="w-full py-3 rounded-xl font-bold text-sm text-white"
                style={{ background: "linear-gradient(135deg, var(--accent), #a855f7)" }}
              >
                ¡Empezar a coleccionar!
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
