"use client";

import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import Avatar from "@/components/Avatar";
import FriendButton from "@/components/FriendButton";
import { useAuthStore } from "@/store/useAuthStore";
import { useFriends, useFriendRequests, useAcceptFriendRequest, useDeclineFriendRequest, useRemoveFriend } from "@/hooks/useFriends";

export default function FriendsPage() {
  const { user } = useAuthStore();
  const { data: friends = [], isLoading: loadingFriends } = useFriends(user);
  const { data: requests = [], isLoading: loadingRequests } = useFriendRequests(user);
  const accept = useAcceptFriendRequest();
  const decline = useDeclineFriendRequest();
  const remove = useRemoveFriend();

  return (
    <div className="flex flex-col gap-5">

      {/* Solicitudes entrantes */}
      <AnimatePresence>
        {requests.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="glass-card p-5"
          >
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-sm font-semibold text-[color:var(--text-primary)]">Solicitudes de amistad</h2>
              <span
                className="text-xs px-2 py-0.5 rounded-full font-bold text-white"
                style={{ background: "var(--accent)" }}
              >
                {requests.length}
              </span>
            </div>
            <div className="flex flex-col gap-3">
              {requests.map((req) => (
                <div key={req.senderId} className="flex items-center gap-3">
                  <Link href={`/profile/${req.senderId}`} className="shrink-0">
                    <Avatar url={req.avatar || null} size="md" ring />
                  </Link>
                  <Link href={`/profile/${req.senderId}`} className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[color:var(--text-primary)] hover:text-[color:var(--accent)] transition-colors">
                      {req.name}
                    </p>
                    <p className="text-xs text-[color:var(--text-muted)]">Te envió una solicitud</p>
                  </Link>
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => user && accept.mutate({ myId: user, senderId: req.senderId })}
                      disabled={accept.isPending}
                      className="text-xs px-3 py-1.5 rounded-lg font-medium text-white disabled:opacity-50"
                      style={{ background: "var(--accent)", boxShadow: "0 0 8px var(--accent-glow)" }}
                    >
                      Aceptar
                    </button>
                    <button
                      type="button"
                      onClick={() => user && decline.mutate({ myId: user, otherId: req.senderId })}
                      disabled={decline.isPending}
                      className="text-xs px-3 py-1.5 rounded-lg font-medium border disabled:opacity-50"
                      style={{ color: "var(--text-muted)", borderColor: "rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)" }}
                    >
                      Rechazar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lista de amigos */}
      <div className="glass-card p-5">
        <h1 className="text-sm font-semibold text-[color:var(--text-primary)] mb-4">
          Amigos
          {friends.length > 0 && (
            <span className="ml-2 text-xs text-[color:var(--text-muted)] font-normal">{friends.length}</span>
          )}
        </h1>

        {loadingFriends || loadingRequests ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass-card animate-pulse" style={{ height: 120, opacity: 0.4 - i * 0.08 }} />
            ))}
          </div>
        ) : friends.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-14 gap-3"
          >
            <span className="text-4xl">💜</span>
            <p className="text-[color:var(--text-secondary)] text-sm">Aún no tenés amigos agregados</p>
            <p className="text-[color:var(--text-muted)] text-xs">Buscá usuarios y enviá solicitudes</p>
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
                  onClick={() => user && remove.mutate({ userId: user, friendId: friend.id })}
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
    </div>
  );
}
