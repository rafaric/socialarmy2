"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { History } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import { useTradeHistory } from "@/hooks/useTradeHistory";
import TradeHistoryItem from "@/components/trade/TradeHistoryItem";

// ---------------------------------------------------------------------------
// Página /market/history
// ---------------------------------------------------------------------------

export default function TradeHistoryPage() {
  const { user } = useAuthStore();
  const { data: history = [], isLoading, isError } = useTradeHistory();

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="glass-card p-5">
        <div className="flex items-center gap-3 mb-1">
          <History className="w-5 h-5" style={{ color: "var(--accent)" }} />
          <h1 className="text-lg font-bold text-[color:var(--text-primary)]">
            Historial de intercambios
          </h1>
        </div>
        <p className="text-xs text-[color:var(--text-muted)]">
          {isLoading
            ? "Cargando..."
            : `${history.length} intercambio${history.length !== 1 ? "s" : ""} realizados`}
        </p>
      </div>

      {/* Loading skeleton */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-xl p-4 animate-pulse"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--glass-border)" }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="h-4 bg-white/10 rounded-full w-20" />
                <div className="h-3 bg-white/5 rounded w-24" />
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 space-y-2 flex flex-col items-center">
                  <div className="h-3 bg-white/5 rounded w-12" />
                  <div className="w-14 aspect-[3/4] bg-white/10 rounded-lg" />
                </div>
                <div className="w-8 h-8 rounded-full bg-white/10" />
                <div className="flex-1 space-y-2 flex flex-col items-center">
                  <div className="h-3 bg-white/5 rounded w-12" />
                  <div className="w-14 aspect-[3/4] bg-white/10 rounded-lg" />
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
            Error al cargar el historial. Intentá de nuevo.
          </p>
        </div>
      )}

      {/* Estado vacío */}
      {!isLoading && !isError && history.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-12 text-center space-y-4"
        >
          <p className="text-4xl">🔄</p>
          <div>
            <p className="text-[color:var(--text-primary)] font-semibold mb-1">
              Todavía no realizaste intercambios
            </p>
            <p className="text-[color:var(--text-muted)] text-sm">
              Cuando completes un trade con otro usuario, aparecerá acá.
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

      {/* Lista de intercambios */}
      {!isLoading && !isError && history.length > 0 && user && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-3"
        >
          {history.map((trade) => (
            <TradeHistoryItem key={trade.id} trade={trade} userId={user} />
          ))}
        </motion.div>
      )}
    </div>
  );
}
