"use client";

import { useAuthStore } from "@/store/useAuthStore";
import {
  useFriendStatus,
  useSendFriendRequest,
  useAcceptFriendRequest,
  useDeclineFriendRequest,
  useRemoveFriend,
} from "@/hooks/useFriends";

interface FriendButtonProps {
  targetId: string;
}

export default function FriendButton({ targetId }: FriendButtonProps) {
  const { user } = useAuthStore();
  const { data: status = "none", isLoading } = useFriendStatus(user, targetId);
  const sendRequest = useSendFriendRequest();
  const accept = useAcceptFriendRequest();
  const decline = useDeclineFriendRequest();
  const remove = useRemoveFriend();

  if (!user || user === targetId || isLoading) return null;

  const isPending = sendRequest.isPending || accept.isPending || decline.isPending || remove.isPending;

  if (status === "accepted") {
    return (
      <button
        type="button"
        disabled={isPending}
        onClick={() => remove.mutate({ userId: user, friendId: targetId })}
        className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all duration-200 border disabled:opacity-50"
        style={{
          color: "var(--text-muted)",
          background: "rgba(255,255,255,0.05)",
          borderColor: "rgba(255,255,255,0.1)",
        }}
      >
        Amigos ✓
      </button>
    );
  }

  if (status === "pending_sent") {
    return (
      <button
        type="button"
        disabled={isPending}
        onClick={() => decline.mutate({ myId: user, otherId: targetId })}
        className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all duration-200 border disabled:opacity-50"
        style={{
          color: "var(--text-muted)",
          background: "rgba(255,255,255,0.05)",
          borderColor: "rgba(255,255,255,0.1)",
        }}
        title="Cancelar solicitud"
      >
        Solicitud enviada
      </button>
    );
  }

  if (status === "pending_received") {
    return (
      <div className="flex gap-1.5">
        <button
          type="button"
          disabled={isPending}
          onClick={() => accept.mutate({ myId: user, senderId: targetId })}
          className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all duration-200 disabled:opacity-50"
          style={{
            color: "#fff",
            background: "var(--accent)",
            boxShadow: "0 0 8px var(--accent-glow)",
          }}
        >
          Aceptar
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => decline.mutate({ myId: user, otherId: targetId })}
          className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all duration-200 border disabled:opacity-50"
          style={{
            color: "var(--text-muted)",
            background: "rgba(255,255,255,0.05)",
            borderColor: "rgba(255,255,255,0.1)",
          }}
        >
          Rechazar
        </button>
      </div>
    );
  }

  // none
  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => sendRequest.mutate({ userId: user, friendId: targetId })}
      className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all duration-200 disabled:opacity-50"
      style={{
        color: "#fff",
        background: "var(--accent)",
        boxShadow: "0 0 8px var(--accent-glow)",
      }}
    >
      + Agregar
    </button>
  );
}
