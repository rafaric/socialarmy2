"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase/browser";
import { getEraByYear, BTS_ERAS } from "@/lib/bts-eras";

interface ArmySinceBadgeProps {
  armySince: string | null | undefined;
  isOwn: boolean;
  profileId: string;
  onUpdate: () => void;
}

export default function ArmySinceBadge({ armySince, isOwn, profileId, onUpdate }: ArmySinceBadgeProps) {
  const [editing, setEditing] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  const year = armySince ? new Date(armySince).getFullYear() : null;
  const era = year ? getEraByYear(year) : null;

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 2012 }, (_, i) => 2013 + i).reverse();

  async function handleSave() {
    if (!selectedYear) return;
    await supabase
      .from("profiles")
      .update({ army_since: `${selectedYear}-01-01` })
      .eq("id", profileId);
    setEditing(false);
    onUpdate();
  }

  if (!armySince && !isOwn) return null;

  return (
    <div className="mt-3">
      {!editing ? (
        <div className="flex items-center gap-2 flex-wrap">
          {era && year ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
              style={{
                background: era.bg,
                border: `1px solid ${era.color}50`,
                color: era.color,
              }}
            >
              <span className="text-base">💜</span>
              <span>Army desde <strong>{year}</strong></span>
              <span className="opacity-60">·</span>
              <span>{era.label} era</span>
            </motion.div>
          ) : isOwn ? (
            <span className="text-xs text-[color:var(--text-muted)] italic">
              ¿Desde cuándo sos Army?
            </span>
          ) : null}

          {isOwn && (
            <button
              type="button"
              onClick={() => { setEditing(true); setSelectedYear(year ?? null); }}
              className="w-6 h-6 flex items-center justify-center rounded text-[color:var(--text-muted)] hover:text-[color:var(--accent)] hover:bg-white/5 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                <path d="M21.731 2.269a2.625 2.625 0 0 0-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 0 0 0-3.712ZM19.513 8.199l-3.712-3.712-8.4 8.4a5.25 5.25 0 0 0-1.32 2.214l-.8 2.685a.75.75 0 0 0 .933.933l2.685-.8a5.25 5.25 0 0 0 2.214-1.32l8.4-8.4Z" />
              </svg>
            </button>
          )}
        </div>
      ) : (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="glass-card p-4 max-w-sm"
          >
            <p className="text-xs text-[color:var(--text-muted)] uppercase tracking-widest mb-3">
              ¿Desde qué año sos Army?
            </p>
            <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto mb-4">
              {years.map((y) => {
                const e = getEraByYear(y);
                const isSelected = selectedYear === y;
                return (
                  <button
                    key={y}
                    type="button"
                    onClick={() => setSelectedYear(y)}
                    className="px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200"
                    style={{
                      background: isSelected ? e.bg : "rgba(255,255,255,0.05)",
                      color: isSelected ? e.color : "var(--text-muted)",
                      border: `1px solid ${isSelected ? e.color : "transparent"}`,
                    }}
                  >
                    {y}
                    {isSelected && <span className="ml-1 opacity-70">· {e.label}</span>}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={!selectedYear}
                onClick={handleSave}
                className="btn-accent text-xs py-1.5 px-4 disabled:opacity-40"
              >
                Guardar
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="text-xs px-4 py-1.5 rounded-lg text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)] hover:bg-white/5 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}
