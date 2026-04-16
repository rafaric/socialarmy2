"use client";

import { useQuery } from "@tanstack/react-query";
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

const Saved = () => {
  const { user } = useAuthStore();
  const { data: posts = [], isLoading } = useSavedPosts(user);

  return (
    <>
      <h1 className="text-2xl uppercase text-center font-bold text-white mb-6">
        Posts guardados
      </h1>
      {isLoading && <p className="text-center text-gray-400 py-8">Cargando...</p>}
      {!isLoading && posts.length === 0 && (
        <p className="text-center text-gray-400 py-8">No tenés posts guardados</p>
      )}
      {posts.map((post) => (
        <div className="mx-4" key={post.id}>
          <PostsCard {...post} />
        </div>
      ))}
    </>
  );
};

export default Saved;
