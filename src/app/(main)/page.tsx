"use client";

export const dynamic = "force-dynamic";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useAuthStore } from "@/store/useAuthStore";
import { useProfile } from "@/hooks/useProfile";
import { usePosts } from "@/hooks/usePosts";
import PostsCard from "@/components/PostsCard";
import PostForm from "@/components/PostForm";
import { BTS_ERAS, getEraByKey } from "@/lib/bts-eras";

export default function Home() {
  const { user } = useAuthStore();
  const { data: profile } = useProfile(user);
  const { data: posts = [], isLoading, isError, error } = usePosts();
  const [activeEra, setActiveEra] = useState<string | null>(null);

  // Eras que tienen al menos un post
  const erasWithPosts = useMemo(() => {
    const keys = new Set(posts.map((p) => p.era).filter(Boolean) as string[]);
    return BTS_ERAS.filter((e) => keys.has(e.key));
  }, [posts]);

  const filtered = useMemo(() => {
    if (!activeEra) return posts;
    return posts.filter((p) => p.era === activeEra);
  }, [posts, activeEra]);

  const userEra = profile?.fav_album ?? null;

  return (
    <>
      <PostForm profile={profile ?? null} />

      {/* Era filter chips */}
      {!isLoading && erasWithPosts.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-4 -mt-1">
          <button
            type="button"
            onClick={() => setActiveEra(null)}
            className="px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200"
            style={{
              background: !activeEra ? "var(--accent)" : "rgba(255,255,255,0.06)",
              color: !activeEra ? "#fff" : "var(--text-muted)",
              boxShadow: !activeEra ? "0 0 10px var(--accent-glow)" : "none",
            }}
          >
            Todos
          </button>

          {erasWithPosts.map((era) => {
            const isActive = activeEra === era.key;
            const isUserEra = userEra === era.key;
            return (
              <motion.button
                key={era.key}
                type="button"
                whileTap={{ scale: 0.95 }}
                onClick={() => setActiveEra(isActive ? null : era.key)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200"
                style={{
                  background: isActive ? era.bg : "rgba(255,255,255,0.06)",
                  color: isActive ? era.color : "var(--text-muted)",
                  border: `1px solid ${isActive ? era.color : "transparent"}`,
                  boxShadow: isActive ? `0 0 10px ${era.bg}` : "none",
                }}
              >
                {isUserEra && <span>💜</span>}
                {era.label}
              </motion.button>
            );
          })}
        </div>
      )}

      {isError ? (
        <div className="glass-card p-4 border border-red-500/30 rounded-xl text-sm text-red-400">
          <p className="font-medium mb-1">Error cargando posts</p>
          <p className="text-xs font-mono opacity-70">
            {error instanceof Error ? error.message : JSON.stringify(error)}
          </p>
        </div>
      ) : isLoading ? (
        <div className="flex flex-col gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="glass-card animate-pulse"
              style={{ height: 160, opacity: 0.4 - i * 0.08 }}
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-20 gap-3"
        >
          <span className="text-5xl">{activeEra ? getEraByKey(activeEra)?.label ?? "💜" : "💜"}</span>
          <p className="text-[color:var(--text-secondary)] text-sm">
            {activeEra ? `No hay posts de esta era todavía` : "Aún no hay posts. ¡Sé el primero!"}
          </p>
          {activeEra && (
            <button
              type="button"
              onClick={() => setActiveEra(null)}
              className="text-xs text-[color:var(--accent)] hover:underline mt-1"
            >
              Ver todos los posts
            </button>
          )}
        </motion.div>
      ) : (
        <div className="flex flex-col gap-4">
          {filtered.map((post) => (
            <PostsCard key={post.id} {...post} />
          ))}
        </div>
      )}
    </>
  );
}
