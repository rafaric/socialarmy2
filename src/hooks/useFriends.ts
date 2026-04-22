import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/browser";
import type { Profile } from "@/types";

export type FriendStatus = "none" | "pending_sent" | "pending_received" | "accepted";

interface FriendRow {
  user_id: string;
  friend_id: string;
  status: "pending" | "accepted";
}

interface FriendRequestRow {
  user_id: string;
  status: string;
  profiles: { id: string; name: string; avatar: string } | { id: string; name: string; avatar: string }[] | null;
}

// Amigos aceptados del usuario (bidireccional por diseño)
export function useFriends(userId: string | null) {
  return useQuery({
    queryKey: ["friends", userId],
    queryFn: async (): Promise<Profile[]> => {
      const { data, error } = await supabase
        .from("friends")
        .select("friend_id, profiles:friend_id(id, name, avatar, bias, fav_album)")
        .eq("user_id", userId!)
        .eq("status", "accepted");
      if (error) throw error;
      return ((data ?? []).map((r: { profiles: unknown }) => r.profiles).filter(Boolean)) as Profile[];
    },
    enabled: !!userId,
  });
}

// Solicitudes entrantes (otros me enviaron a mí)
export function useFriendRequests(userId: string | null) {
  return useQuery({
    queryKey: ["friend-requests", userId],
    queryFn: async (): Promise<{ senderId: string; name: string; avatar: string }[]> => {
      const { data, error } = await supabase
        .from("friends")
        .select("user_id, status, profiles:user_id(id, name, avatar)")
        .eq("friend_id", userId!)
        .eq("status", "pending");
      if (error) throw error;
      return ((data ?? []) as FriendRequestRow[]).map((r) => ({
        senderId: r.user_id,
        name: (r.profiles as { name: string } | null)?.name ?? "",
        avatar: (r.profiles as { avatar: string } | null)?.avatar ?? "",
      }));
    },
    enabled: !!userId,
  });
}

// Estado de la relación entre dos usuarios
export function useFriendStatus(myId: string | null, theirId: string | null) {
  return useQuery({
    queryKey: ["friend-status", myId, theirId],
    queryFn: async (): Promise<FriendStatus> => {
      const { data, error } = await supabase
        .from("friends")
        .select("user_id, friend_id, status")
        .or(`and(user_id.eq.${myId},friend_id.eq.${theirId}),and(user_id.eq.${theirId},friend_id.eq.${myId})`);
      if (error) throw error;
      const rows = (data ?? []) as FriendRow[];

      const iSent = rows.find((r) => r.user_id === myId && r.friend_id === theirId);
      const theySent = rows.find((r) => r.user_id === theirId && r.friend_id === myId);

      if (iSent?.status === "accepted") return "accepted";
      if (iSent?.status === "pending") return "pending_sent";
      if (theySent?.status === "pending") return "pending_received";
      return "none";
    },
    enabled: !!myId && !!theirId,
  });
}

function invalidateFriendQueries(queryClient: ReturnType<typeof useQueryClient>, userId: string, otherId: string) {
  queryClient.invalidateQueries({ queryKey: ["friends", userId] });
  queryClient.invalidateQueries({ queryKey: ["friend-requests", userId] });
  queryClient.invalidateQueries({ queryKey: ["friend-status", userId, otherId] });
  queryClient.invalidateQueries({ queryKey: ["friend-status", otherId, userId] });
}

// Enviar solicitud de amistad (server-side via API route)
export function useSendFriendRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, friendId }: { userId: string; friendId: string }) => {
      void userId; // Se usa solo para invalidar queries; la auth ocurre server-side.
      const res = await fetch("/api/friends/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friend_id: friendId }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to send friend request" }));
        throw new Error(
          (err as { error?: string }).error ?? "Failed to send friend request"
        );
      }

      return res.json() as Promise<{ ok: boolean }>;  // tabla friends usa clave compuesta
    },
    onMutate: async ({ friendId }) => {
      // Optimistic update: marcar como pending en el cache.
      await queryClient.cancelQueries({ queryKey: ["friendship", friendId] });
      const previous = queryClient.getQueryData(["friendship", friendId]);
      queryClient.setQueryData(["friendship", friendId], { status: "pending" });
      return { previous, friendId };
    },
    onError: (_err, _vars, context) => {
      // Rollback del optimistic update.
      if (context?.previous !== undefined) {
        queryClient.setQueryData(["friendship", context.friendId], context.previous);
      }
    },
    onSettled: (_data, _err, { friendId }) => {
      queryClient.invalidateQueries({ queryKey: ["friendship", friendId] });
      queryClient.invalidateQueries({ queryKey: ["friends"] });
    },
  });
}

// Aceptar solicitud entrante
export function useAcceptFriendRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ myId, senderId }: { myId: string; senderId: string }) => {
      // Actualizar la solicitud entrante a aceptada
      const { error: e1 } = await supabase
        .from("friends")
        .update({ status: "accepted" })
        .eq("user_id", senderId)
        .eq("friend_id", myId);
      if (e1) throw e1;

      // Insertar el lado inverso (para que ambos se vean como amigos)
      const { error: e2 } = await supabase
        .from("friends")
        .insert({ user_id: myId, friend_id: senderId, status: "accepted" });
      if (e2) throw e2;

      // Notificación al emisor de que fue aceptado
      await supabase.from("notifications").insert({
        notification_type: "friend_accept",
        user_emisor: myId,
        user_receptor: senderId,
        post_id: null,
      });
    },
    onSuccess: (_data, { myId, senderId }) => {
      invalidateFriendQueries(queryClient, myId, senderId);
    },
  });
}

// Rechazar/cancelar solicitud
export function useDeclineFriendRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ myId, otherId }: { myId: string; otherId: string }) => {
      // Elimina en ambas direcciones por si acaso
      const { error } = await supabase
        .from("friends")
        .delete()
        .or(`and(user_id.eq.${myId},friend_id.eq.${otherId}),and(user_id.eq.${otherId},friend_id.eq.${myId})`);
      if (error) throw error;
    },
    onSuccess: (_data, { myId, otherId }) => {
      invalidateFriendQueries(queryClient, myId, otherId);
    },
  });
}

// Eliminar amistad (borra ambas direcciones)
export function useRemoveFriend() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, friendId }: { userId: string; friendId: string }) => {
      const { error } = await supabase
        .from("friends")
        .delete()
        .or(`and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`);
      if (error) throw error;
    },
    onSuccess: (_data, { userId, friendId }) => {
      invalidateFriendQueries(queryClient, userId, friendId);
    },
  });
}
