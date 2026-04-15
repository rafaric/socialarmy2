import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/browser";
import type { Like, Comment } from "@/types";

// ─── Likes ───────────────────────────────────────────────────────────────────

export function useLikes(postId: string) {
  return useQuery({
    queryKey: ["likes", postId],
    queryFn: async (): Promise<Like[]> => {
      const { data, error } = await supabase
        .from("likes")
        .select()
        .eq("post_id", postId);
      if (error) throw error;
      return (data ?? []) as Like[];
    },
  });
}

export function useToggleLike(postId: string, authorId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, alreadyLiked, likeId }: { userId: string; alreadyLiked: boolean; likeId?: string }) => {
      if (alreadyLiked && likeId) {
        await supabase.from("likes").delete().eq("id", likeId);
      } else {
        await supabase.from("likes").insert({ post_id: postId, user_id: userId });
        await supabase.from("notifications").insert({
          notification_type: "like",
          user_emisor: userId,
          user_receptor: authorId,
          post_id: postId,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["likes", postId] });
    },
  });
}

// ─── Comments ────────────────────────────────────────────────────────────────

export function useComments(postId: string) {
  return useQuery({
    queryKey: ["comments", postId],
    queryFn: async (): Promise<Comment[]> => {
      const { data, error } = await supabase
        .from("posts")
        .select("*, profiles(*)")
        .eq("parent", postId);
      if (error) throw error;
      return (data ?? []) as Comment[];
    },
  });
}

export function useAddComment(postId: string, authorId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, content }: { userId: string; content: string }) => {
      const { error } = await supabase.from("posts").insert({
        content,
        author: userId,
        parent: postId,
      });
      if (error) throw error;
      await supabase.from("notifications").insert({
        notification_type: "comentario",
        user_emisor: userId,
        user_receptor: authorId,
        post_id: postId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comments", postId] });
    },
  });
}

// ─── Saved posts ─────────────────────────────────────────────────────────────

export function useIsSaved(postId: string, userId: string | null) {
  return useQuery({
    queryKey: ["saved", postId, userId],
    queryFn: async (): Promise<boolean> => {
      const { data } = await supabase
        .from("saved_posts")
        .select()
        .eq("post_id", postId)
        .eq("user_id", userId!);
      return (data?.length ?? 0) > 0;
    },
    enabled: !!userId,
  });
}

export function useToggleSave(postId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, isSaved }: { userId: string; isSaved: boolean }) => {
      if (isSaved) {
        await supabase.from("saved_posts").delete().eq("post_id", postId).eq("user_id", userId);
      } else {
        await supabase.from("saved_posts").insert({ user_id: userId, post_id: postId });
      }
    },
    onSuccess: (_data, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ["saved", postId, userId] });
    },
  });
}
