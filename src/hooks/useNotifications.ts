import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Notification } from "@/types";

export function useNotifications(userId: string | null) {
  return useQuery({
    queryKey: ["notifications", userId],
    queryFn: async (): Promise<Notification[]> => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*, profiles:user_emisor(*)")
        .eq("user_receptor", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Notification[];
    },
    enabled: !!userId,
  });
}
