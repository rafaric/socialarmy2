"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getArgentinaEvent } from "@/lib/bts-events";

interface Countdown {
  days: number; hours: number; minutes: number; seconds: number; past: boolean;
}

function calc(date: string): Countdown {
  const diff = new Date(`${date}T00:00:00`).getTime() - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, past: true };
  return {
    days:    Math.floor(diff / 86_400_000),
    hours:   Math.floor((diff % 86_400_000) / 3_600_000),
    minutes: Math.floor((diff % 3_600_000) / 60_000),
    seconds: Math.floor((diff % 60_000) / 1_000),
    past: false,
  };
}

export default function ArgentinaButton() {
  const [open, setOpen] = useState(false);
  const argEv = getArgentinaEvent();
  const argDate = argEv?.dates[0] ?? null;
  const [cd, setCd] = useState<Countdown | null>(() => argDate ? calc(argDate) : null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!argDate) return;
    const id = setInterval(() => setCd(calc(argDate)), 1000);
    return () => clearInterval(id);
  }, [argDate]);

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  if (!argDate || !cd) return null;

  return (
    <div ref={ref} className="relative">
      {/* Botón corazón argentino */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Countdown Argentina"
        className="relative flex items-center justify-center w-8 h-8"
      >
        <motion.span
          className="text-xl select-none"
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          style={{ filter: "drop-shadow(0 0 6px #74acdf88)" }}
        >
          🩵
        </motion.span>
        {/* Pulso de fondo */}
        <motion.span
          className="absolute inset-0 rounded-full"
          animate={{ scale: [1, 1.6, 1], opacity: [0.3, 0, 0.3] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          style={{ background: "radial-gradient(circle, #74acdf55 0%, transparent 70%)" }}
        />
      </button>

      {/* Popover */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.95 }}
            transition={{ duration: 0.18 }}
            className="absolute left-1/2 -translate-x-1/2 top-10 z-50 glass-card p-4 w-64 shadow-2xl"
            style={{ background: "rgba(13, 21, 38, 0.96)", border: "1px solid #cc293650", backdropFilter: "blur(24px)" }}
          >
            <p className="text-[10px] uppercase tracking-widest text-[color:var(--text-muted)] mb-2">
              🇦🇷 Argentina — primer recital
            </p>
            <p className="text-xs font-semibold text-[color:var(--text-primary)] mb-0.5">
              {argEv?.venue}
            </p>
            <p className="text-[10px] text-[color:var(--text-muted)] mb-3">
              {argEv?.city} · {new Date(`${argDate}T12:00:00`).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" })}
            </p>

            {cd.past ? (
              <p className="text-sm text-center text-[color:var(--text-muted)]">¡Ya pasó! 💜</p>
            ) : (
              <div className="flex gap-2">
                {[
                  { v: cd.days,    l: "días" },
                  { v: cd.hours,   l: "hs" },
                  { v: cd.minutes, l: "min" },
                  { v: cd.seconds, l: "seg" },
                ].map(({ v, l }) => (
                  <div key={l} className="flex-1 flex flex-col items-center rounded-lg py-2" style={{ background: "#cc293618" }}>
                    <span className="text-xl font-bold tabular-nums leading-none" style={{ color: "#cc2936" }}>
                      {String(v).padStart(2, "0")}
                    </span>
                    <span className="text-[9px] text-[color:var(--text-muted)] mt-0.5 uppercase tracking-wide">{l}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Fechas */}
            <div className="flex gap-1.5 mt-3 flex-wrap">
              {argEv?.dates.map((d) => (
                <span key={d} className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "#cc293618", color: "#cc2936" }}>
                  {new Date(`${d}T12:00:00`).toLocaleDateString("es-AR", { day: "numeric", month: "short" })}
                </span>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
