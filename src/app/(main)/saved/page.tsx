"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import PostsCard from "@/components/PostsCard";
import { supabase } from "@/lib/supabase/browser";
import { useAuthStore } from "@/store/useAuthStore";
import type { Post, Profile, Photo, TaggedFriend } from "@/types";

interface PostFromSupabase {
  id: string;
  content: string;
  created_at: string;
  author: string;
  photos: Photo[] | null;
  tagged: TaggedFriend[] | null;
  parent: string | null;
  profiles: Profile | Profile[] | null;
}

function mapPostToType(post: PostFromSupabase): Post {
  let authorProfile: Profile;
  if (Array.isArray(post.profiles)) {
    authorProfile = post.profiles[0] ?? { id: post.author, name: "Usuario", avatar: "" };
  } else {
    authorProfile = post.profiles ?? { id: post.author, name: "Usuario", avatar: "" };
  }
  return {
    id: post.id,
    content: post.content,
    created_at: post.created_at,
    author: post.author,
    photos: post.photos,
    tagged: post.tagged,
    parent: post.parent,
    profiles: authorProfile,
  };
}

function useSavedPosts(userId: string | null) {
  return useQuery({
    queryKey: ["saved-posts", userId],
    queryFn: async (): Promise<Post[]> => {
      const { data: saved } = await supabase
        .from("saved_posts")
        .select("post_id")
        .eq("user_id", userId!);

      if (!saved?.length) return [];

      const ids = saved.map((s: { post_id: string }) => s.post_id);
      const { data, error } = await supabase
        .from("posts")
        .select("id, content, created_at, author, photos, tagged, parent, profiles(id, name, avatar)")
        .in("id", ids);

      if (error) throw error;
      return (data ?? []).map(mapPostToType);
    },
    enabled: !!userId,
  });
}

export default function SavedPage() {
  const { user } = useAuthStore();
  const { data: posts = [], isLoading } = useSavedPosts(user);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: "var(--accent-glow)", border: "1px solid var(--glass-border)" }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" style={{ color: "var(--accent)" }}>
            <path fillRule="evenodd" d="M6.32 2.577a49.255 49.255 0 0 1 11.36 0c1.497.174 2.57 1.46 2.57 2.93V21a.75.75 0 0 1-1.085.67L12 18.089l-7.165 3.583A.75.75 0 0 1 3.75 21V5.507c0-1.47 1.073-2.756 2.57-2.93Z" clipRule="evenodd" />
          </svg>
        </div>
        <div>
          <h1 className="text-lg font-bold text-[color:var(--text-primary)]">Guardados</h1>
          <p className="text-xs text-[color:var(--text-muted)]">
            {isLoading ? "Cargando..." : `${posts.length} post${posts.length !== 1 ? "s" : ""}`}
          </p>
        </div>
      </div>

      {/* Loading skeleton */}
      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass-card py-5 px-6 animate-pulse">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-white/10" />
                <div className="space-y-2 flex-1">
                  <div className="h-3 bg-white/10 rounded w-1/4" />
                  <div className="h-2 bg-white/5 rounded w-1/6" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-3 bg-white/10 rounded w-full" />
                <div className="h-3 bg-white/10 rounded w-3/4" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && posts.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card py-16 flex flex-col items-center gap-4 text-center"
        >
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: "var(--accent-glow)", border: "1px solid var(--glass-border)" }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8" style={{ color: "var(--accent)" }}>
              <path fillRule="evenodd" d="M6.32 2.577a49.255 49.255 0 0 1 11.36 0c1.497.174 2.57 1.46 2.57 2.93V21a.75.75 0 0 1-1.085.67L12 18.089l-7.165 3.583A.75.75 0 0 1 3.75 21V5.507c0-1.47 1.073-2.756 2.57-2.93Z" clipRule="evenodd" />
            </svg>
          </div>
          <p className="text-[color:var(--text-primary)] font-medium">No hay posts guardados</p>
          <p className="text-[color:var(--text-muted)] text-sm">Guardá posts desde el feed con el menú ⋮</p>
        </motion.div>
      )}

      {/* Posts */}
      {posts.map((post) => (
        <PostsCard key={post.id} {...post} />
      ))}
    </div>
  );
}
