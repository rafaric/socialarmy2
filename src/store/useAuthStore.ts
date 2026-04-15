import { create } from "zustand";
import type { Session } from "@supabase/supabase-js";

interface AuthStore {
  session: Session | null;
  user: string | null;
  setSession: (session: Session | null) => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  session: null,
  user: null,
  setSession: (session) =>
    set({ session, user: session?.user?.id ?? null }),
}));
