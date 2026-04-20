"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";

interface Card {
  id: string;
  name: string;
  member: string;
  era: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  image_url: string | null;
}

const RARITY_CONFIG = {
  common:    { label: "Común",      color: "#9ca3af" },
  rare:      { label: "Rara",       color: "#60a5fa" },
  epic:      { label: "Épica",      color: "#a855f7" },
  legendary: { label: "Legendaria", color: "#f59e0b" },
};

const RARITIES = ["common", "rare", "epic", "legendary"] as const;
const MEMBERS = ["RM", "Jin", "Suga", "J-Hope", "Jimin", "V", "Jungkook"];
const ERAS = ["2cool4skool", "hyyh", "wings", "love_yourself", "mots", "be", "butter", "proof", "arirang"];

function EditRow({ card, onSave, onCancel }: { card: Card; onSave: (data: Partial<Card>) => void; onCancel: () => void }) {
  const [name, setName] = useState(card.name);
  const [member, setMember] = useState(card.member);
  const [era, setEra] = useState(card.era);
  const [rarity, setRarity] = useState(card.rarity);

  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="bg-white/5"
    >
      <td className="px-3 py-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-2 py-1 rounded text-xs bg-white/10 border border-white/20 text-[color:var(--text-primary)] outline-none"
        />
      </td>
      <td className="px-3 py-2">
        <select
          value={member}
          onChange={(e) => setMember(e.target.value)}
          className="px-2 py-1 rounded text-xs bg-white/10 border border-white/20 text-[color:var(--text-primary)] outline-none"
        >
          {MEMBERS.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </td>
      <td className="px-3 py-2">
        <select
          value={era}
          onChange={(e) => setEra(e.target.value)}
          className="px-2 py-1 rounded text-xs bg-white/10 border border-white/20 text-[color:var(--text-primary)] outline-none"
        >
          {ERAS.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
      </td>
      <td className="px-3 py-2">
        <select
          value={rarity}
          onChange={(e) => setRarity(e.target.value as Card["rarity"])}
          className="px-2 py-1 rounded text-xs bg-white/10 border border-white/20 text-[color:var(--text-primary)] outline-none"
          style={{ color: RARITY_CONFIG[rarity as keyof typeof RARITY_CONFIG]?.color }}
        >
          {RARITIES.map((r) => <option key={r} value={r}>{RARITY_CONFIG[r].label}</option>)}
        </select>
      </td>
      <td className="px-3 py-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onSave({ name, member, era, rarity })}
            className="text-[10px] px-2 py-1 rounded font-bold text-white"
            style={{ background: "var(--accent)" }}
          >
            Guardar
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="text-[10px] px-2 py-1 rounded text-[color:var(--text-muted)] hover:bg-white/10"
          >
            Cancelar
          </button>
        </div>
      </td>
    </motion.tr>
  );
}

export default function AdminCardsPage() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterMember, setFilterMember] = useState("all");
  const [filterRarity, setFilterRarity] = useState("all");
  const [showNew, setShowNew] = useState(false);
  const [newCard, setNewCard] = useState({ name: "", member: "RM", era: "arirang", rarity: "common" as Card["rarity"] });

  const { data: cards = [], isLoading } = useQuery<Card[]>({
    queryKey: ["admin", "cards"],
    queryFn: () => fetch("/api/admin/cards").then((r) => r.json()),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Card> }) =>
      fetch(`/api/admin/cards/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => r.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin", "cards"] }); setEditingId(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetch(`/api/admin/cards/${id}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "cards"] }),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      fetch("/api/admin/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCard),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "cards"] });
      setShowNew(false);
      setNewCard({ name: "", member: "RM", era: "arirang", rarity: "common" });
    },
  });

  const filtered = cards.filter((c) =>
    (filterMember === "all" || c.member === filterMember) &&
    (filterRarity === "all" || c.rarity === filterRarity)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[color:var(--text-primary)]">Catálogo de Cartas</h1>
          <p className="text-sm text-[color:var(--text-muted)] mt-0.5">{cards.length} cartas en total</p>
        </div>
        <button
          type="button"
          onClick={() => setShowNew(!showNew)}
          className="px-4 py-2 rounded-xl text-sm font-bold text-white"
          style={{ background: "linear-gradient(135deg, var(--accent), #a855f7)" }}
        >
          + Nueva carta
        </button>
      </div>

      {/* Formulario nueva carta */}
      <AnimatePresence>
        {showNew && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="glass-card rounded-xl overflow-hidden"
          >
            <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
              <input
                placeholder="Nombre de la carta"
                value={newCard.name}
                onChange={(e) => setNewCard({ ...newCard, name: e.target.value })}
                className="col-span-2 md:col-span-1 px-3 py-2 rounded-lg text-sm bg-white/5 border border-white/10 text-[color:var(--text-primary)] placeholder-[color:var(--text-muted)] outline-none"
              />
              <select
                value={newCard.member}
                onChange={(e) => setNewCard({ ...newCard, member: e.target.value })}
                className="px-3 py-2 rounded-lg text-sm bg-white/5 border border-white/10 text-[color:var(--text-primary)] outline-none"
              >
                {MEMBERS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
              <select
                value={newCard.era}
                onChange={(e) => setNewCard({ ...newCard, era: e.target.value })}
                className="px-3 py-2 rounded-lg text-sm bg-white/5 border border-white/10 text-[color:var(--text-primary)] outline-none"
              >
                {ERAS.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
              <select
                value={newCard.rarity}
                onChange={(e) => setNewCard({ ...newCard, rarity: e.target.value as Card["rarity"] })}
                className="px-3 py-2 rounded-lg text-sm bg-white/5 border border-white/10 outline-none"
                style={{ color: RARITY_CONFIG[newCard.rarity].color }}
              >
                {RARITIES.map((r) => <option key={r} value={r}>{RARITY_CONFIG[r].label}</option>)}
              </select>
              <button
                type="button"
                onClick={() => createMutation.mutate()}
                disabled={!newCard.name || createMutation.isPending}
                className="col-span-2 md:col-span-1 py-2 rounded-lg text-sm font-bold text-white disabled:opacity-40"
                style={{ background: "var(--accent)" }}
              >
                {createMutation.isPending ? "Creando..." : "Crear"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        <select
          value={filterMember}
          onChange={(e) => setFilterMember(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-xs bg-white/5 border border-white/10 text-[color:var(--text-secondary)] outline-none"
        >
          <option value="all">Todos los miembros</option>
          {MEMBERS.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select
          value={filterRarity}
          onChange={(e) => setFilterRarity(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-xs bg-white/5 border border-white/10 text-[color:var(--text-secondary)] outline-none"
        >
          <option value="all">Todas las rarezas</option>
          {RARITIES.map((r) => <option key={r} value={r}>{RARITY_CONFIG[r].label}</option>)}
        </select>
        <span className="text-xs text-[color:var(--text-muted)] self-center ml-auto">{filtered.length} cartas</span>
      </div>

      {/* Tabla */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-12 rounded-xl" />)}
        </div>
      ) : (
        <div className="glass-card rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-[10px] uppercase tracking-widest text-[color:var(--text-muted)]">
                <th className="px-3 py-3 text-left">Carta</th>
                <th className="px-3 py-3 text-left">Miembro</th>
                <th className="px-3 py-3 text-left">Era</th>
                <th className="px-3 py-3 text-left">Rareza</th>
                <th className="px-3 py-3 text-left">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              <AnimatePresence>
                {filtered.map((card) =>
                  editingId === card.id ? (
                    <EditRow
                      key={card.id}
                      card={card}
                      onSave={(data) => updateMutation.mutate({ id: card.id, data })}
                      onCancel={() => setEditingId(null)}
                    />
                  ) : (
                    <motion.tr
                      key={card.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          {card.image_url ? (
                            <Image src={card.image_url} alt={card.name} width={28} height={40} className="rounded object-cover" />
                          ) : (
                            <div className="w-7 h-10 rounded flex items-center justify-center text-base" style={{ background: `${RARITY_CONFIG[card.rarity]?.color}20` }}>
                              💜
                            </div>
                          )}
                          <span className="text-xs text-[color:var(--text-primary)]">{card.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-[color:var(--text-secondary)]">{card.member}</td>
                      <td className="px-3 py-2.5 text-xs text-[color:var(--text-muted)]">{card.era}</td>
                      <td className="px-3 py-2.5">
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{
                            background: `${RARITY_CONFIG[card.rarity]?.color}20`,
                            color: RARITY_CONFIG[card.rarity]?.color,
                          }}
                        >
                          {RARITY_CONFIG[card.rarity]?.label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingId(card.id)}
                            className="text-[10px] px-2 py-1 rounded text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)] hover:bg-white/10 transition-colors"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`¿Eliminar "${card.name}"?`)) deleteMutation.mutate(card.id);
                            }}
                            className="text-[10px] px-2 py-1 rounded text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  )
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
