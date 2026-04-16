"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import Avatar from "@/components/Avatar";
import Link from "next/link";
import { useAuthStore } from "@/store/useAuthStore";
import {
  useNotifications,
  useMarkAllRead,
  useDeleteNotification,
} from "@/hooks/useNotifications";

const NOTIFICATION_LABELS: Record<string, { text: string; icon: string }> = {
  like:       { text: "le dio 💜 a tu post",       icon: "💜" },
  comentario: { text: "comentó tu post",            icon: "💬" },
  post:       { text: "compartió una publicación",  icon: "📢" },
};

export default function NotificationsPage() {
  const { user } = useAuthStore();
  const { data: notifications = [], isLoading } = useNotifications(user);
  const markAllRead = useMarkAllRead(user);
  const deleteNotification = useDeleteNotification(user);

  // Marcar todas como leídas al entrar
  useEffect(() => {
    if (!user || notifications.length === 0) return;
    const hasUnread = notifications.some((n) => !n.read);
    if (hasUnread) markAllRead.mutate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, notifications.length]);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: "var(--accent-glow)", border: "1px solid var(--glass-border)" }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" style={{ color: "var(--accent)" }}>
            <path fillRule="evenodd" d="M5.25 9a6.75 6.75 0 0 1 13.5 0v.75c0 2.123.8 4.057 2.118 5.52a.75.75 0 0 1-.297 1.206c-1.544.57-3.16.99-4.831 1.243a3.75 3.75 0 1 1-7.48 0 24.585 24.585 0 0 1-4.831-1.244.75.75 0 0 1-.298-1.205A8.217 8.217 0 0 0 5.25 9.75V9Zm4.502 8.9a2.25 2.25 0 1 0 4.496 0 25.057 25.057 0 0 1-4.496 0Z" clipRule="evenodd" />
          </svg>
        </div>
        <div>
          <h1 className="text-lg font-bold text-[color:var(--text-primary)]">Notificaciones</h1>
          <p className="text-xs text-[color:var(--text-muted)]">
            {isLoading ? "Cargando..." : `${notifications.length} notificación${notifications.length !== 1 ? "es" : ""}`}
          </p>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="glass-card divide-y divide-white/5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-4 px-6 py-4 animate-pulse">
              <div className="w-11 h-11 rounded-full bg-white/10 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-white/10 rounded w-3/4" />
                <div className="h-2 bg-white/5 rounded w-1/3" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && notifications.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card py-16 flex flex-col items-center gap-4 text-center"
        >
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: "var(--accent-glow)", border: "1px solid var(--glass-border)" }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8" style={{ color: "var(--accent)" }}>
              <path fillRule="evenodd" d="M5.25 9a6.75 6.75 0 0 1 13.5 0v.75c0 2.123.8 4.057 2.118 5.52a.75.75 0 0 1-.297 1.206c-1.544.57-3.16.99-4.831 1.243a3.75 3.75 0 1 1-7.48 0 24.585 24.585 0 0 1-4.831-1.244.75.75 0 0 1-.298-1.205A8.217 8.217 0 0 0 5.25 9.75V9Zm4.502 8.9a2.25 2.25 0 1 0 4.496 0 25.057 25.057 0 0 1-4.496 0Z" clipRule="evenodd" />
            </svg>
          </div>
          <p className="text-[color:var(--text-primary)] font-medium">Todo al día</p>
          <p className="text-[color:var(--text-muted)] text-sm">No hay notificaciones nuevas</p>
        </motion.div>
      )}

      {/* Notification list */}
      {notifications.length > 0 && (
        <div className="glass-card overflow-hidden divide-y divide-white/5">
          <AnimatePresence initial={false}>
            {notifications.map((noti, i) => {
              const meta = NOTIFICATION_LABELS[noti.notification_type] ?? { text: "interactuó con vos", icon: "✨" };
              return (
                <motion.div
                  key={noti.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8, height: 0 }}
                  transition={{ delay: i * 0.03, duration: 0.2 }}
                  className="relative flex items-center gap-4 px-6 py-4 transition-colors group"
                  style={!noti.read ? {
                    background: "rgba(var(--accent-rgb, 124, 77, 206), 0.06)",
                    borderLeft: "2px solid var(--accent)",
                  } : {}}
                >
                  {/* Unread dot */}
                  {!noti.read && (
                    <span
                      className="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full"
                      style={{ background: "var(--accent)" }}
                    />
                  )}

                  {/* Avatar + icon badge */}
                  <div className="relative shrink-0 z-10">
                    <Link href={`/profile/${noti.profiles?.id}`}>
                      <Avatar url={noti.profiles?.avatar ?? null} size="md" />
                    </Link>
                    <span className="absolute -bottom-0.5 -right-0.5 text-sm leading-none">
                      {meta.icon}
                    </span>
                  </div>

                  {/* Text — clickable toward the post if post_id exists */}
                  <Link
                    href={noti.post_id ? `/post/${noti.post_id}` : `/profile/${noti.profiles?.id}`}
                    className="flex-1 min-w-0 hover:opacity-80 transition-opacity"
                  >
                    <p className="text-sm text-[color:var(--text-secondary)]">
                      <span className="font-semibold text-[color:var(--text-primary)]">
                        {noti.profiles?.name}
                      </span>{" "}
                      {meta.text}
                    </p>
                    <p className="text-xs text-[color:var(--text-muted)] mt-0.5">
                      Hace {formatDistanceToNow(new Date(noti.created_at), { locale: es })}
                    </p>
                  </Link>

                  {/* Delete button */}
                  <button
                    type="button"
                    onClick={() => deleteNotification.mutate(noti.id)}
                    className="opacity-0 group-hover:opacity-100 w-7 h-7 flex items-center justify-center rounded-lg text-[color:var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-all shrink-0 z-10"
                    aria-label="Eliminar notificación"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                      <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                    </svg>
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
