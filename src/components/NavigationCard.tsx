"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAuthStore } from "@/store/useAuthStore";
import { useUnreadCount } from "@/hooks/useNotifications";
import { supabase } from "@/lib/supabase/browser";

const NAV_ITEMS = [
  {
    href: "/",
    label: "Inicio",
    exact: true,
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M11.47 3.841a.75.75 0 0 1 1.06 0l8.69 8.69a.75.75 0 1 0 1.06-1.061l-8.689-8.69a2.25 2.25 0 0 0-3.182 0l-8.69 8.69a.75.75 0 1 0 1.061 1.06l8.69-8.689Z" />
        <path d="m12 5.432 8.159 8.159c.03.03.06.058.091.086v6.198c0 1.035-.84 1.875-1.875 1.875H15a.75.75 0 0 1-.75-.75v-4.5a.75.75 0 0 0-.75-.75h-3a.75.75 0 0 0-.75.75V21a.75.75 0 0 1-.75.75H5.625a1.875 1.875 0 0 1-1.875-1.875v-6.198a1.2 1.2 0 0 0 .091-.086L12 5.432Z" />
      </svg>
    ),
  },
  {
    href: null,
    label: "Amigos",
    friendsLink: true,
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M4.5 6.375a4.125 4.125 0 1 1 8.25 0 4.125 4.125 0 0 1-8.25 0ZM14.25 8.625a3.375 3.375 0 1 1 6.75 0 3.375 3.375 0 0 1-6.75 0ZM1.5 19.125a7.125 7.125 0 0 1 14.25 0v.003l-.001.119a.75.75 0 0 1-.363.63 13.067 13.067 0 0 1-6.761 1.873c-2.472 0-4.786-.684-6.76-1.873a.75.75 0 0 1-.364-.63l-.001-.122ZM17.25 19.128l-.001.144a2.25 2.25 0 0 1-.233.96 10.088 10.088 0 0 0 5.06-1.01.75.75 0 0 0 .42-.643 4.875 4.875 0 0 0-6.957-4.611 8.586 8.586 0 0 1 1.71 5.157v.003Z" />
      </svg>
    ),
  },
  {
    href: "/saved",
    label: "Guardados",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path fillRule="evenodd" d="M6.32 2.577a49.255 49.255 0 0 1 11.36 0c1.497.174 2.57 1.46 2.57 2.93V21a.75.75 0 0 1-1.085.67L12 18.089l-7.165 3.583A.75.75 0 0 1 3.75 21V5.507c0-1.47 1.073-2.756 2.57-2.93Z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    href: "/notifications",
    label: "Notificaciones",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path fillRule="evenodd" d="M5.25 9a6.75 6.75 0 0 1 13.5 0v.75c0 2.123.8 4.057 2.118 5.52a.75.75 0 0 1-.297 1.206c-1.544.57-3.16.99-4.831 1.243a3.75 3.75 0 1 1-7.48 0 24.585 24.585 0 0 1-4.831-1.244.75.75 0 0 1-.298-1.205A8.217 8.217 0 0 0 5.25 9.75V9Zm4.502 8.9a2.25 2.25 0 1 0 4.496 0 25.057 25.057 0 0 1-4.496 0Z" clipRule="evenodd" />
      </svg>
    ),
  },
];

function NavigationCard() {
  const pathname = usePathname();
  const router = useRouter();
  const { session, setSession, user } = useAuthStore();
  const { data: unreadCount = 0 } = useUnreadCount(user);

  async function signout() {
    await supabase.auth.signOut();
    setSession(null);
    router.push("/auth/login");
  }

  function isActive(item: typeof NAV_ITEMS[number]) {
    if (item.friendsLink) {
      return pathname.startsWith("/profile/") && pathname.includes("tab=friends");
    }
    if (item.exact) return pathname === item.href;
    return pathname === item.href;
  }

  function getHref(item: typeof NAV_ITEMS[number]) {
    if (item.friendsLink) return `/profile/${session?.user?.id}?tab=friends`;
    return item.href ?? "/";
  }

  return (
    <nav className="glass-card md:py-6 md:px-4 py-2 px-2 mb-5 md:mb-5 rounded-none md:rounded-[var(--radius-card)]">
      {/* Logo — desktop only */}
      <div className="hidden md:flex flex-col items-center mb-8 gap-1">
        <span className="font-monotone text-xl text-gold tracking-widest">ARMY</span>
        <span className="text-[10px] tracking-[0.3em] text-[color:var(--text-muted)] uppercase">social network</span>
      </div>

      {/* Nav items */}
      <div className="flex md:flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item);
          return (
            <Link
              key={item.label}
              href={getHref(item)}
              className="relative flex-1 md:flex-none group"
            >
              {active && (
                <motion.div
                  layoutId="nav-indicator"
                  className="nav-active absolute inset-0 rounded-lg"
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
              <span
                className={`relative flex items-center justify-center md:justify-start gap-3 md:px-4 px-2 py-3 rounded-lg transition-colors duration-200 ${
                  active
                    ? "text-white"
                    : "text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] hover:bg-white/5"
                }`}
              >
                <span className="relative">
                  {item.icon}
                  {item.label === "Notificaciones" && unreadCount > 0 && (
                    <span
                      className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center text-white"
                      style={{ background: "var(--accent)" }}
                    >
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </span>
                <span className="hidden md:block text-sm font-medium">{item.label}</span>
              </span>
            </Link>
          );
        })}

        {/* Logout — desktop only */}
        <button
          type="button"
          onClick={signout}
          className="hidden md:flex items-center gap-3 px-4 py-3 rounded-lg text-[color:var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors duration-200 mt-8"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
            <path fillRule="evenodd" d="M7.5 3.75A1.5 1.5 0 0 0 6 5.25v13.5a1.5 1.5 0 0 0 1.5 1.5h6a1.5 1.5 0 0 0 1.5-1.5V15a.75.75 0 0 1 1.5 0v3.75a3 3 0 0 1-3 3h-6a3 3 0 0 1-3-3V5.25a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3V9A.75.75 0 0 1 15 9V5.25a1.5 1.5 0 0 0-1.5-1.5h-6Zm10.72 4.72a.75.75 0 0 1 1.06 0l3 3a.75.75 0 0 1 0 1.06l-3 3a.75.75 0 1 1-1.06-1.06l1.72-1.72H9a.75.75 0 0 1 0-1.5h10.94l-1.72-1.72a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
          </svg>
          <span className="text-sm font-medium">Salir</span>
        </button>
      </div>
    </nav>
  );
}

export default NavigationCard;
