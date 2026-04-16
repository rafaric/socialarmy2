import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/browser";
import type { Post, Photo, TaggedFriend, Profile } from "@/types";
import { v4 as uuidv4 } from "uuid";

// Tipo que representa el resultado de la query de Supabase
// profiles puede ser un array o un objeto dependiendo del query
interface PostWithProfile {
  id: string;
  content: string;
  created_at: string;
  author: string;
  photos: Photo[] | null;
  tagged: TaggedFriend[] | null;
  parent: string | null;
  era: string | null;
  now_playing: string | null;
  bts_members: string[] | null;
  profiles: { id: string; name: string; avatar: string } | { id: string; name: string; avatar: string }[] | null;
}

// Mappea el resultado de Supabase al tipo Post
function mapPostToType(post: PostWithProfile): Post {
  // profiles puede venir como array (si hay múltiples) o como objeto único
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
    era: post.era,
    now_playing: post.now_playing,
    bts_members: post.bts_members,
    profiles: authorProfile,
  };
}

export function usePosts() {
  return useQuery({
    queryKey: ["posts"],
    queryFn: async (): Promise<Post[]> => {
      const { data, error } = await supabase
        .from("posts")
        .select("id, content, created_at, author, photos, tagged, parent, era, now_playing, bts_members, profiles!posts_author_fkey(id, name, avatar)")
        .is("parent", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapPostToType);
    },
  });
}

export function useUserPosts(userId: string | null) {
  return useQuery({
    queryKey: ["posts", "user", userId],
    queryFn: async (): Promise<Post[]> => {
      const { data, error } = await supabase
        .from("posts")
        .select("id, content, created_at, author, photos, tagged, parent, era, now_playing, bts_members, profiles!posts_author_fkey(id, name, avatar)")
        .is("parent", null)
        .eq("author", userId!);
      if (error) throw error;
      return (data ?? []).map(mapPostToType);
    },
    enabled: !!userId,
  });
}

interface CreatePostInput {
  userId: string;
  content: string;
  uploads: Photo[];
  selectedFriends: TaggedFriend[];
  friends: Profile[];
  era?: string | null;
  nowPlaying?: string | null;
  btsMembers?: string[];
}

export function useCreatePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, content, uploads, selectedFriends, friends, era, nowPlaying, btsMembers }: CreatePostInput) => {
      if (!content.trim()) throw new Error("El contenido no puede estar vacío");

      const { data, error } = await supabase
        .from("posts")
        .insert({ author: userId, content, photos: uploads, tagged: selectedFriends, era: era ?? null, now_playing: nowPlaying ?? null, bts_members: btsMembers?.length ? btsMembers : null })
        .select()
        .single();

      if (error) throw error;

      // Fire notifications without blocking the success path
      Promise.all(
        friends.map((friend) =>
          supabase.from("notifications").insert({
            notification_type: "post",
            user_emisor: userId,
            user_receptor: friend.id,
            post_id: data.id,
          })
        )
      ).catch(() => {
        // Notifications are best-effort — don't block feed refresh on failure
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
  });
}

export function useRealtimePosts() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const name = `realtime-posts-${Math.random().toString(36).slice(2)}`;
    const channel = supabase.channel(name);

    channel
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "posts" },
        () => { queryClient.invalidateQueries({ queryKey: ["posts"] }); }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}

export function useUploadPhotos() {
  return useMutation({
    mutationFn: async (files: FileList): Promise<Photo[]> => {
      const uploaded: Photo[] = [];
      for (const file of Array.from(files)) {
        const newName = Date.now() + file.name;
        const { data, error } = await supabase.storage.from("photos").upload(newName, file, {
          contentType: file.type,
        });
        if (error) throw error;
        uploaded.push({
          id: uuidv4(),
          tipo: file.type,
          url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/photos/${data.path}`,
        });
      }
      return uploaded;
    },
  });
}
