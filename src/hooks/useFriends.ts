import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/types";

async function getFriendIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("friends")
    .select("friend_id")
    .eq("user_id", userId);
  if (error) throw error;
  return (data ?? []).map((r: { friend_id: string }) => r.friend_id);
}

export function useFriends(userId: string | null) {
  return useQuery({
    queryKey: ["friends", userId],
    queryFn: async (): Promise<Profile[]> => {
      const ids = await getFriendIds(userId!);
      if (!ids.length) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .in("id", ids);
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
    enabled: !!userId,
  });
}

export function useAddFriend() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, friendId }: { userId: string; friendId: string }) => {
      const { error } = await supabase
        .from("friends")
        .insert({ user_id: userId, friend_id: friendId });
      if (error) throw error;
    },
    onSuccess: (_data, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ["friends", userId] });
    },
  });
}

export function useRemoveFriend() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, friendId }: { userId: string; friendId: string }) => {
      const { error } = await supabase
        .from("friends")
        .delete()
        .eq("user_id", userId)
        .eq("friend_id", friendId);
      if (error) throw error;
    },
    onSuccess: (_data, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ["friends", userId] });
    },
  });
}
