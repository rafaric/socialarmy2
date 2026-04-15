import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/browser";
import type { Post, Photo, TaggedFriend, Profile } from "@/types";
import { v4 as uuidv4 } from "uuid";

export function usePosts() {
  return useQuery({
    queryKey: ["posts"],
    queryFn: async (): Promise<Post[]> => {
      const { data, error } = await supabase
        .from("posts")
        .select("id, content, created_at, author, photos, tagged, profiles(id, name, avatar)")
        .is("parent", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Post[];
    },
  });
}

export function useUserPosts(userId: string | null) {
  return useQuery({
    queryKey: ["posts", "user", userId],
    queryFn: async (): Promise<Post[]> => {
      const { data, error } = await supabase
        .from("posts")
        .select("id, content, created_at, author, photos, profiles(id, name, avatar)")
        .is("parent", null)
        .eq("author", userId!);
      if (error) throw error;
      return (data ?? []) as unknown as Post[];
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
}

export function useCreatePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, content, uploads, selectedFriends, friends }: CreatePostInput) => {
      if (!content.trim()) throw new Error("El contenido no puede estar vacío");

      const { data, error } = await supabase
        .from("posts")
        .insert({ author: userId, content, photos: uploads, tagged: selectedFriends })
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
