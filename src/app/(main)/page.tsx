"use client";

export const dynamic = "force-dynamic";

import { useAuthStore } from "@/store/useAuthStore";
import { useProfile } from "@/hooks/useProfile";
import { usePosts } from "@/hooks/usePosts";
import PostsCard from "@/components/PostsCard";
import PostForm from "@/components/PostForm";

export default function Home() {
  const { user } = useAuthStore();
  const { data: profile } = useProfile(user);
  const { data: posts = [], isLoading, isError, error } = usePosts();

  return (
    <>
      <PostForm profile={profile ?? null} />

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
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <span className="text-5xl">💜</span>
          <p className="text-[color:var(--text-secondary)] text-sm">
            Aún no hay posts. ¡Sé el primero!
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {posts.map((post) => (
            <PostsCard key={post.id} {...post} />
          ))}
        </div>
      )}
    </>
  );
}
