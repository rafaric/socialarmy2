"use client";

import { useEffect, useRef } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { useLoginStreak } from "@/hooks/usePacks";
import { toast } from "sonner";

export default function LoginStreakInit() {
  const { user } = useAuthStore();
  const loginStreak = useLoginStreak();
  const called = useRef(false);

  useEffect(() => {
    if (!user || called.current) return;
    called.current = true;
    loginStreak.mutate(undefined, {
      onSuccess: (data) => {
        if (data.pack) {
          toast.success(`🎉 ¡${data.streak} días seguidos! Ganaste un Sobre Super`, {
            duration: 5000,
          });
        }
      },
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return null;
}
