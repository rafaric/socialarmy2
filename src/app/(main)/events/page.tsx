"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { BTS_EVENTS, type Region } from "@/lib/bts-events";

const REGIONS: { key: Region | "all"; label: string }[] = [
  { key: "all",           label: "Todos" },
  { key: "south_america", label: "Sudamérica" },
  { key: "north_america", label: "Norteamérica" },
  { key: "europe",        label: "Europa" },
  { key: "asia",          label: "Asia" },
  { key: "oceania",       label: "Oceanía" },
];

function isPast(dates: string[]): boolean {
  const today = new Date().toISOString().slice(0, 10);
  return dates[dates.length - 1] < today;
}

function formatDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("es-AR", {
    day: "numeric", month: "short",
  });
}

export default function EventsPage() {
  const [region, setRegion] = useState<Region | "all">("all");

  const today = new Date().toISOString().slice(0, 10);
  const filtered = BTS_EVENTS
    .filter((e) => region === "all" || e.region === region)
    .sort((a, b) => a.dates[0].localeCompare(b.dates[0]));

  const upcoming = filtered.filter((e) => e.dates.some((d) => d >= today));
  const past     = filtered.filter((e) => isPast(e.dates));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[color:var(--text-primary)]">Eventos BTS</h1>
        <p className="text-sm text-[color:var(--text-muted)] mt-0.5">
          Arirang World Tour 2026 — {BTS_EVENTS.length} shows · 23 países
        </p>
      </div>

      {/* Region filter */}
      <div className="flex gap-2 flex-wrap">
        {REGIONS.map((r) => {
          const active = region === r.key;
          return (
            <motion.button
              key={r.key}
              type="button"
              whileTap={{ scale: 0.95 }}
              onClick={() => setRegion(r.key)}
              className="px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200"
              style={{
                background: active ? "var(--accent)" : "rgba(255,255,255,0.06)",
                color: active ? "#fff" : "var(--text-muted)",
                boxShadow: active ? "0 0 10px var(--accent-glow)" : "none",
              }}
            >
              {r.label}
            </motion.button>
          );
        })}
      </div>

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-[color:var(--text-muted)]">
            Próximos — {upcoming.length} shows
          </h2>
          {upcoming.map((event, i) => (
            <motion.article
              key={event.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className={`glass-card p-4 flex items-center gap-4 ${event.isArgentina ? "ring-1" : ""}`}
              style={event.isArgentina ? { ringColor: "#cc2936", boxShadow: "0 0 16px #cc293620" } : {}}
            >
              <span className="text-3xl shrink-0">{event.flag}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-[color:var(--text-primary)]">
                    {event.city}
                    {event.isArgentina && <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded font-bold" style={{ background: "#cc293622", color: "#cc2936" }}>¡ARGENTINA!</span>}
                  </p>
                  <span className="text-xs text-[color:var(--text-muted)]">{event.country}</span>
                </div>
                <p className="text-xs text-[color:var(--text-muted)] mt-0.5 truncate">{event.venue}</p>
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  {event.dates.map((d) => {
                    const isNext = d >= new Date().toISOString().slice(0, 10);
                    return (
                      <span
                        key={d}
                        className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                        style={{
                          background: isNext ? "var(--accent)22" : "rgba(255,255,255,0.05)",
                          color: isNext ? "var(--accent)" : "var(--text-muted)",
                        }}
                      >
                        {formatDate(d)}
                      </span>
                    );
                  })}
                </div>
              </div>
            </motion.article>
          ))}
        </section>
      )}

      {/* Past */}
      {past.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-[color:var(--text-muted)]">
            Realizados — {past.length} shows
          </h2>
          {past.map((event) => (
            <article
              key={event.id}
              className="glass-card p-4 flex items-center gap-4 opacity-45"
            >
              <span className="text-3xl shrink-0 grayscale">{event.flag}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[color:var(--text-secondary)]">{event.city}</p>
                <p className="text-xs text-[color:var(--text-muted)] truncate">{event.venue}</p>
                <div className="flex gap-1.5 mt-1.5 flex-wrap">
                  {event.dates.map((d) => (
                    <span key={d} className="text-[11px] text-[color:var(--text-muted)]">
                      {formatDate(d)}
                    </span>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </section>
      )}

      {filtered.length === 0 && (
        <div className="text-center py-16 text-[color:var(--text-muted)] text-sm">
          No hay eventos para esta región
        </div>
      )}
    </div>
  );
}
