"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import Avatar from "@/components/Avatar";
import { useAuthStore } from "@/store/useAuthStore";
import { useFriends, useRemoveFriend } from "@/hooks/useFriends";

export default function FriendsPage() {
  const { user } = useAuthStore();
  const { data: friends = [], isLoading } = useFriends(user);
  const removeFriend = useRemoveFriend();

  return (
    <div className="glass-card p-6 mb-5">
      <h1 className="text-lg font-semibold text-[color:var(--text-primary)] mb-6">Amigos</h1>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass-card animate-pulse" style={{ height: 120, opacity: 0.4 - i * 0.08 }} />
          ))}
        </div>
      ) : friends.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-20 gap-3"
        >
          <span className="text-5xl">💜</span>
          <p className="text-[color:var(--text-secondary)] text-sm">Aún no tenés amigos agregados</p>
          <p className="text-[color:var(--text-muted)] text-xs">Visitá un perfil y agregalo como amigo</p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {friends.map((friend) => (
            <motion.div
              key={friend.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card p-4 flex flex-col items-center gap-3 hover:border-[color:var(--accent)]/30 transition-colors relative"
            >
              <button
                type="button"
                onClick={() => user && removeFriend.mutate({ userId: user, friendId: friend.id })}
                className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded text-[color:var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                title="Eliminar amigo"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                  <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                </svg>
              </button>
              <Link href={`/profile/${friend.id}`} className="flex flex-col items-center gap-2 hover:opacity-80 transition-opacity">
                <Avatar url={friend.avatar || null} size="md" ring />
                <p className="text-sm text-[color:var(--text-primary)] font-medium text-center">{friend.name}</p>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
