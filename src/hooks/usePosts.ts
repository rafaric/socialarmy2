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
    profiles: authorProfile,
  };
}

export function usePosts() {
  return useQuery({
    queryKey: ["posts"],
    queryFn: async (): Promise<Post[]> => {
      const { data, error } = await supabase
        .from("posts")
        .select("id, content, created_at, author, photos, tagged, parent, era, now_playing, profiles(id, name, avatar)")
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
        .select("id, content, created_at, author, photos, tagged, parent, era, now_playing, profiles(id, name, avatar)")
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
}

export function useCreatePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, content, uploads, selectedFriends, friends, era, nowPlaying }: CreatePostInput) => {
      if (!content.trim()) throw new Error("El contenido no puede estar vacío");

      const { data, error } = await supabase
        .from("posts")
        .insert({ author: userId, content, photos: uploads, tagged: selectedFriends, era: era ?? null, now_playing: nowPlaying ?? null })
        .select()
        .single();

      if (error) throw error;

      await Promise.all(
        friends.map((friend) =>
          supabase.from("notifications").insert({
            notification_type: "post",
            user_emisor: userId,
            user_receptor: friend.id,
            post_id: data.id,
          })
        )
      );

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
  });
}

export function useUploadPhotos() {
  return useMutation({
    mutationFn: async (files: FileList): Promise<Photo[]> => {
      const uploaded: Photo[] = [];
      for (const file of Array.from(files)) {
        const newName = Date.now() + file.name;
        const { data, error } = await supabase.storage.from("photos").upload(newName, file);
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
