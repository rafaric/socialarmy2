import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/browser";

export interface PollVoteRow {
  id: string;
  user_id: string;
  option_index: number;
}

export function usePollVotes(postId: string) {
  return useQuery<PollVoteRow[]>({
    queryKey: ["poll_votes", postId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("poll_votes")
        .select("id, user_id, option_index")
        .eq("post_id", postId);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useVotePoll(postId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (optionIndex: number) => {
      const res = await fetch(`/api/polls/${postId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ option_index: optionIndex }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Error al votar");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["poll_votes", postId] });
    },
  });
}

export function useNotifyPollEnd(postId: string) {
  return useMutation({
    mutationFn: async () => {
      await fetch(`/api/polls/${postId}/notify-end`, { method: "POST" });
    },
  });
}
