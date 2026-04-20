"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import Image from "next/image";

interface Stats {
  packs: { total: number; opened: number; pending: number; simple: number; super: number };
  cards: Record<string, number>;
  recent: { created_at: string; pack_type: string; activity: string }[];
  users: number;
}

interface UserResult {
  id: string;
  name: string;
  avatar: string;
}

const RARITY_CONFIG = {
  common:    { label: "Común",      color: "#9ca3af" },
  rare:      { label: "Rara",       color: "#60a5fa" },
  epic:      { label: "Épica",      color: "#a855f7" },
  legendary: { label: "Legendaria", color: "#f59e0b" },
};

function StatCard({ label, value, sub, color }: { label: string; value: number | string; sub?: string; color?: string }) {
  return (
    <div className="glass-card p-4 rounded-xl">
      <p className="text-[10px] font-bold tracking-widest uppercase text-[color:var(--text-muted)] mb-1">{label}</p>
      <p className="text-2xl font-bold" style={{ color: color ?? "var(--text-primary)" }}>{value}</p>
      {sub && <p className="text-[11px] text-[color:var(--text-muted)] mt-0.5">{sub}</p>}
    </div>
  );
}

export default function AdminPage() {
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserResult | null>(null);
  const [packType, setPackType] = useState<"simple" | "super">("simple");
  const [reason, setReason] = useState("");
  const [giftDone, setGiftDone] = useState(false);

  const { data: stats, isLoading } = useQuery<Stats>({
    queryKey: ["admin", "stats"],
    queryFn: () => fetch("/api/admin/stats").then((r) => r.json()),
    refetchInterval: 30_000,
  });

  const { data: searchResults = [] } = useQuery<UserResult[]>({
    queryKey: ["admin", "users", search],
    queryFn: () => fetch(`/api/admin/gift-pack?q=${encodeURIComponent(search)}`).then((r) => r.json()),
    enabled: search.length >= 2,
  });

  const giftMutation = useMutation({
    mutationFn: () =>
      fetch("/api/admin/gift-pack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient_id: selectedUser!.id, pack_type: packType, reason }),
      }).then((r) => r.json()),
    onSuccess: () => {
      setGiftDone(true);
      setSelectedUser(null);
      setSearch("");
      setReason("");
      setTimeout(() => setGiftDone(false), 3000);
    },
  });

  const openRate = stats ? Math.round((stats.packs.opened / (stats.packs.total || 1)) * 100) : 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[color:var(--text-primary)]">Dashboard Admin</h1>
        <p className="text-sm text-[color:var(--text-muted)] mt-0.5">Sistema de coleccionables</p>
      </div>

      {/* Stats generales */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-20 rounded-xl" />)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Usuarios" value={stats?.users ?? 0} />
            <StatCard label="Sobres totales" value={stats?.packs.total ?? 0} sub={`${openRate}% abiertos`} />
            <StatCard label="Sin abrir" value={stats?.packs.pending ?? 0} color="#f59e0b" />
            <StatCard label="Cartas repartidas" value={Object.values(stats?.cards ?? {}).reduce((a, b) => a + b, 0)} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Sobres Super" value={stats?.packs.super ?? 0} color="#a855f7" />
            <StatCard label="Sobres Simple" value={stats?.packs.simple ?? 0} color="#60a5fa" />
            {Object.entries(RARITY_CONFIG).map(([key, cfg]) => (
              <StatCard key={key} label={cfg.label} value={stats?.cards[key] ?? 0} color={cfg.color} />
            ))}
          </div>

          {/* Actividad reciente */}
          <div className="glass-card rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/5">
              <p className="text-sm font-semibold text-[color:var(--text-primary)]">Actividad reciente</p>
            </div>
            <div className="divide-y divide-white/5">
              {(stats?.recent ?? []).map((r, i) => (
                <div key={i} className="px-4 py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{
                        background: r.pack_type === "super" ? "rgba(168,85,247,0.15)" : "rgba(96,165,250,0.15)",
                        color: r.pack_type === "super" ? "#a855f7" : "#60a5fa",
                      }}
                    >
                      {r.pack_type === "super" ? "Super" : "Simple"}
                    </span>
                    <span className="text-xs text-[color:var(--text-secondary)]">{r.activity}</span>
                  </div>
                  <span className="text-[10px] text-[color:var(--text-muted)]">
                    {new Date(r.created_at).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Regalo de sobres */}
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/5">
          <p className="text-sm font-semibold text-[color:var(--text-primary)]">Regalar sobre</p>
          <p className="text-xs text-[color:var(--text-muted)] mt-0.5">Enviá un sobre directamente a un usuario por un evento especial</p>
        </div>
        <div className="p-4 space-y-4">
          {/* Búsqueda de usuario */}
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar usuario por nombre..."
              value={selectedUser ? selectedUser.name : search}
              onChange={(e) => { setSearch(e.target.value); setSelectedUser(null); }}
              className="w-full px-3 py-2.5 rounded-lg text-sm bg-white/5 border border-white/10 text-[color:var(--text-primary)] placeholder-[color:var(--text-muted)] outline-none focus:border-[color:var(--accent)]"
            />
            {searchResults.length > 0 && !selectedUser && (
              <div className="absolute top-full mt-1 inset-x-0 glass-card rounded-lg overflow-hidden z-10 border border-white/10">
                {searchResults.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => { setSelectedUser(u); setSearch(""); }}
                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/5 transition-colors text-left"
                  >
                    {u.avatar && (
                      <Image src={u.avatar} alt={u.name} width={28} height={28} className="rounded-full object-cover" />
                    )}
                    <span className="text-sm text-[color:var(--text-primary)]">{u.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedUser && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg"
              style={{ background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.3)" }}
            >
              {selectedUser.avatar && (
                <Image src={selectedUser.avatar} alt={selectedUser.name} width={24} height={24} className="rounded-full object-cover" />
              )}
              <span className="text-sm text-[color:var(--text-primary)] flex-1">{selectedUser.name}</span>
              <button type="button" onClick={() => setSelectedUser(null)} className="text-[color:var(--text-muted)] hover:text-white text-xs">✕</button>
            </motion.div>
          )}

          <div className="flex gap-2">
            {(["simple", "super"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setPackType(t)}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all"
                style={{
                  background: packType === t
                    ? t === "super" ? "linear-gradient(135deg, #7c3aed, #a855f7)" : "linear-gradient(135deg, #1d4ed8, #60a5fa)"
                    : "rgba(255,255,255,0.05)",
                  color: packType === t ? "#fff" : "var(--text-secondary)",
                  border: packType === t ? "none" : "1px solid rgba(255,255,255,0.08)",
                }}
              >
                {t === "super" ? "✨ Sobre Super" : "💜 Sobre Simple"}
              </button>
            ))}
          </div>

          <input
            type="text"
            placeholder="Motivo (opcional, ej: Cumpleaños de Jin)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg text-sm bg-white/5 border border-white/10 text-[color:var(--text-primary)] placeholder-[color:var(--text-muted)] outline-none focus:border-[color:var(--accent)]"
          />

          <button
            type="button"
            onClick={() => giftMutation.mutate()}
            disabled={!selectedUser || giftMutation.isPending}
            className="w-full py-3 rounded-xl font-bold text-sm text-white disabled:opacity-40 transition-opacity"
            style={{ background: "linear-gradient(135deg, var(--accent), #a855f7)" }}
          >
            {giftMutation.isPending ? "Enviando..." : giftDone ? "✅ ¡Sobre enviado!" : "Enviar sobre"}
          </button>
        </div>
      </div>
    </div>
  );
}
