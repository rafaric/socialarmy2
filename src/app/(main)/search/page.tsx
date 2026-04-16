"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import Avatar from "@/components/Avatar";
import { useAuthStore } from "@/store/useAuthStore";
import FriendButton from "@/components/FriendButton";
import { useDebounce, useSearchProfiles, useSearchPosts } from "@/hooks/useSearch";
import { getMemberByKey } from "@/lib/bts-members";
import { getEraByKey } from "@/lib/bts-eras";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

type Tab = "usuarios" | "posts";

export default function SearchPage() {
  const { user } = useAuthStore();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("usuarios");
  const debouncedQuery = useDebounce(query, 300);

  const { data: profiles = [], isFetching: fetchingProfiles } = useSearchProfiles(debouncedQuery);
  const { data: posts = [], isFetching: fetchingPosts } = useSearchPosts(debouncedQuery);

  const isSearching = fetchingProfiles || fetchingPosts;
  const hasQuery = debouncedQuery.length >= 2;

  return (
    <div>
      {/* Search input */}
      <div className="glass-card px-4 py-3 mb-5 flex items-center gap-3">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"
          className="w-5 h-5 shrink-0 transition-colors"
          style={{ color: query ? "var(--accent)" : "var(--text-muted)" }}
        >
          <path fillRule="evenodd" d="M10.5 3.75a6.75 6.75 0 1 0 0 13.5 6.75 6.75 0 0 0 0-13.5ZM2.25 10.5a8.25 8.25 0 1 1 14.59 5.28l4.69 4.69a.75.75 0 1 1-1.06 1.06l-4.69-4.69A8.25 8.25 0 0 1 2.25 10.5Z" clipRule="evenodd" />
        </svg>
        <input
          type="search"
          placeholder="Buscar usuarios, posts..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
          className="flex-1 bg-transparent text-sm text-[color:var(--text-primary)] placeholder:text-[color:var(--text-muted)] outline-none"
        />
        {isSearching && (
          <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin shrink-0"
            style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }}
          />
        )}
        {query && !isSearching && (
          <button type="button" onClick={() => setQuery("")}
            className="text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)] transition-colors shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
            </svg>
          </button>
        )}
      </div>

      {/* Empty state — no query */}
      {!hasQuery && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-20 gap-3"
        >
          <span className="text-5xl">🔍</span>
          <p className="text-[color:var(--text-secondary)] text-sm">Escribí al menos 2 caracteres</p>
        </motion.div>
      )}

      {/* Tabs + results */}
      {hasQuery && (
        <AnimatePresence mode="wait">
          <motion.div key="results" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>

            {/* Tabs */}
            <div className="flex gap-1 mb-4">
              {(["usuarios", "posts"] as Tab[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className="relative px-4 py-2 text-sm font-medium rounded-lg transition-colors capitalize"
                  style={{
                    background: tab === t ? "var(--accent)" : "rgba(255,255,255,0.05)",
                    color: tab === t ? "#fff" : "var(--text-muted)",
                    boxShadow: tab === t ? "0 0 12px var(--accent-glow)" : "none",
                  }}
                >
                  {t}
                  <span
                    className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full"
                    style={{
                      background: tab === t ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.08)",
                    }}
                  >
                    {t === "usuarios" ? profiles.length : posts.length}
                  </span>
                </button>
              ))}
            </div>

            {/* Usuarios */}
            {tab === "usuarios" && (
              <div className="flex flex-col gap-3">
                {profiles.length === 0 && !fetchingProfiles ? (
                  <EmptyResults label="usuarios" query={debouncedQuery} />
                ) : (
                  profiles.map((profile) => {
                    const bias = profile.bias ? getMemberByKey(profile.bias) : null;
                    return (
                      <motion.div
                        key={profile.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="glass-card px-4 py-3 flex items-center gap-3"
                      >
                        <Link href={`/profile/${profile.id}`} className="shrink-0">
                          <Avatar url={profile.avatar || null} size="md" ring />
                        </Link>
                        <div className="flex-1 min-w-0">
                          <Link href={`/profile/${profile.id}`}
                            className="text-sm font-semibold text-[color:var(--text-primary)] hover:text-[color:var(--accent)] transition-colors"
                          >
                            {profile.name}
                          </Link>
                          {bias && (
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <img src={bias.photo} alt={bias.name}
                                className="w-3.5 h-3.5 rounded-full object-cover object-top"
                              />
                              <span className="text-xs" style={{ color: bias.color }}>
                                {bias.name}
                              </span>
                            </div>
                          )}
                        </div>
                        <FriendButton targetId={profile.id} />
                      </motion.div>
                    );
                  })
                )}
              </div>
            )}

            {/* Posts */}
            {tab === "posts" && (
              <div className="flex flex-col gap-3">
                {posts.length === 0 && !fetchingPosts ? (
                  <EmptyResults label="posts" query={debouncedQuery} />
                ) : (
                  posts.map((post) => {
                    const author = Array.isArray(post.profiles)
                      ? post.profiles[0]
                      : post.profiles;
                    const era = post.era ? getEraByKey(post.era) : null;
                    return (
                      <motion.div
                        key={post.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                      >
                        <Link href={`/post/${post.id}`} className="block glass-card px-4 py-3 hover:border-[color:var(--accent)]/30 transition-colors">
                          {/* Author row */}
                          <div className="flex items-center gap-2 mb-2">
                            <Avatar url={author?.avatar || null} size="sm" />
                            <span className="text-sm font-medium text-[color:var(--text-primary)]">
                              {author?.name}
                            </span>
                            <span className="text-xs text-[color:var(--text-muted)] ml-auto">
                              {formatDistanceToNow(new Date(post.created_at), { locale: es })}
                            </span>
                          </div>

                          {/* Content with highlighted query */}
                          <p className="text-sm text-[color:var(--text-secondary)] line-clamp-3 leading-relaxed">
                            <Highlight text={post.content} query={debouncedQuery} />
                          </p>

                          {/* Era + members */}
                          {(era || (post.bts_members?.length ?? 0) > 0) && (
                            <div className="flex items-center gap-2 flex-wrap mt-2">
                              {era && (
                                <span
                                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                                  style={{ background: era.bg, color: era.color, border: `1px solid ${era.color}40` }}
                                >
                                  ✨ {era.label}
                                </span>
                              )}
                              {post.bts_members?.map((key) => {
                                const m = getMemberByKey(key);
                                if (!m) return null;
                                return (
                                  <span key={key} className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full"
                                    style={{ background: `${m.color}18`, color: m.color, border: `1px solid ${m.color}40` }}
                                  >
                                    <img src={m.photo} alt={m.name} className="w-3 h-3 rounded-full object-cover object-top" />
                                    {m.name}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </Link>
                      </motion.div>
                    );
                  })
                )}
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}

function EmptyResults({ label, query }: { label: string; query: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="glass-card py-14 flex flex-col items-center gap-3"
    >
      <span className="text-4xl">💜</span>
      <p className="text-[color:var(--text-secondary)] text-sm">
        No se encontraron {label} para{" "}
        <span className="font-semibold text-[color:var(--text-primary)]">"{query}"</span>
      </p>
    </motion.div>
  );
}

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="rounded px-0.5" style={{ background: "var(--accent-glow)", color: "var(--accent)" }}>
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
}
