"use client";

import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeftRight, Heart, Clock, ShoppingBag, X as XIcon } from "lucide-react";
import Avatar from "@/components/Avatar";
import Link from "next/link";
import { useAuthStore } from "@/store/useAuthStore";
import {
  useNotifications,
  useMarkAllRead,
  useDeleteNotification,
} from "@/hooks/useNotifications";
import type { Notification } from "@/types";

// ---------------------------------------------------------------------------
// Labels de notificaciones existentes + tipos trading
// ---------------------------------------------------------------------------

const NOTIFICATION_LABELS: Record<string, { text: string; icon: string }> = {
  like:           { text: "le dio 💜 a tu post",          icon: "💜" },
  comentario:     { text: "comentó tu post",               icon: "💬" },
  post:           { text: "compartió una publicación",     icon: "📢" },
  friend_request: { text: "te envió una solicitud de amistad", icon: "🤝" },
  friend_accept:  { text: "aceptó tu solicitud de amistad",    icon: "✨" },
  poll_vote:      { text: "votó en tu encuesta",               icon: "📊" },
  poll_ended:     { text: "Tu encuesta finalizó",              icon: "🏁" },
  // Trading system
  trade_offer_received:   { text: "hizo una oferta por tu carta",           icon: "🔔" },
  trade_offer_accepted:   { text: "tu oferta fue aceptada — conseguiste la carta", icon: "🎉" },
  trade_offer_rejected:   { text: "tu oferta fue rechazada",                icon: "❌" },
  wishlist_card_listed:   { text: "una carta de tu wishlist está en el mercado", icon: "💜" },
  listing_expired:        { text: "tu listing expiró",                       icon: "⏰" },
  trade_match_suggested:  { text: "match sugerido — alguien tiene lo que querés", icon: "🤝" },
};

// ---------------------------------------------------------------------------
// Íconos lucide para tipos de trading (renderizado inline en lugar del emoji)
// ---------------------------------------------------------------------------

function TradingIcon({ type }: { type: string }) {
  const iconClass = "w-3.5 h-3.5";
  const color = "var(--accent)";

  switch (type) {
    case "trade_offer_received":
      return <ArrowLeftRight className={iconClass} style={{ color }} />;
    case "trade_offer_accepted":
      return <ArrowLeftRight className={iconClass} style={{ color: "#4ade80" }} />;
    case "trade_offer_rejected":
      return <XIcon className={iconClass} style={{ color: "#f87171" }} />;
    case "wishlist_card_listed":
      return <Heart className={iconClass} style={{ color }} />;
    case "listing_expired":
      return <Clock className={iconClass} style={{ color: "#fb923c" }} />;
    case "trade_match_suggested":
      return <ShoppingBag className={iconClass} style={{ color }} />;
    default:
      return null;
  }
}

const TRADING_TYPES = new Set([
  "trade_offer_received",
  "trade_offer_accepted",
  "trade_offer_rejected",
  "wishlist_card_listed",
  "listing_expired",
  "trade_match_suggested",
]);

/**
 * Determina el href de navegación para una notificación.
 * Para tipos de trading usa reference_id + reference_type.
 * Para tipos legacy usa post_id o profile.
 */
function getNotificationHref(noti: Notification): string {
  if (TRADING_TYPES.has(noti.notification_type)) {
    if (noti.reference_type === "listing" && noti.reference_id) {
      return `/market/${noti.reference_id}`;
    }
    if (noti.reference_type === "offer" && noti.reference_id) {
      return `/market/my-listings`;
    }
    if (
      noti.notification_type === "listing_expired" ||
      noti.notification_type === "trade_offer_rejected"
    ) {
      return `/market/my-listings`;
    }
    return "/market";
  }
  return noti.post_id ? `/post/${noti.post_id}` : `/profile/${noti.profiles?.id}`;
}

export default function NotificationsPage() {
  const { user } = useAuthStore();
  const { data: notifications = [], isLoading } = useNotifications(user);
  const markAllRead = useMarkAllRead(user);
  const deleteNotification = useDeleteNotification(user);

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
        <div className="flex-1">
          <h1 className="text-lg font-bold text-[color:var(--text-primary)]">Notificaciones</h1>
          <p className="text-xs text-[color:var(--text-muted)]">
            {isLoading ? "Cargando..." : `${notifications.length} notificación${notifications.length !== 1 ? "es" : ""}`}
          </p>
        </div>
        {notifications.some((n) => !n.read) && (
          <button
            type="button"
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
            className="text-xs text-[color:var(--accent)] hover:opacity-70 transition-opacity disabled:opacity-40 shrink-0"
          >
            Marcar todas como leídas
          </button>
        )}
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
              const isTrading = TRADING_TYPES.has(noti.notification_type);
              const href = getNotificationHref(noti);
              const tradingIcon = isTrading ? <TradingIcon type={noti.notification_type} /> : null;

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
                    {isTrading ? (
                      /* Para notificaciones del sistema (trading), mostramos un ícono de trading en lugar de avatar */
                      <div
                        className="w-11 h-11 rounded-full flex items-center justify-center"
                        style={{ background: "var(--accent-glow)", border: "1px solid var(--glass-border)" }}
                      >
                        {tradingIcon ?? <span className="text-base">{meta.icon}</span>}
                      </div>
                    ) : (
                      <>
                        <Link href={`/profile/${noti.profiles?.id}`}>
                          <Avatar url={noti.profiles?.avatar ?? null} size="md" />
                        </Link>
                        <span className="absolute -bottom-0.5 -right-0.5 text-sm leading-none">
                          {meta.icon}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Text — clickable con navegación según tipo */}
                  <Link
                    href={href}
                    className="flex-1 min-w-0 hover:opacity-80 transition-opacity"
                  >
                    <p className="text-sm text-[color:var(--text-secondary)]">
                      {isTrading ? (
                        /* Notificaciones de trading: sin nombre de usuario (origen del sistema) */
                        <span>{meta.text}</span>
                      ) : (
                        <>
                          <span className="font-semibold text-[color:var(--text-primary)]">
                            {noti.profiles?.name}
                          </span>{" "}
                          {meta.text}
                        </>
                      )}
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
