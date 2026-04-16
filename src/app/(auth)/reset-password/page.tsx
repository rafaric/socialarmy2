"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase/browser";

type PageState = "waiting" | "ready" | "success";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [pageState, setPageState] = useState<PageState>("waiting");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Supabase procesa el token del hash automáticamente.
    // Cuando el evento PASSWORD_RECOVERY llega, la sesión recovery ya está activa.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setPageState("ready");
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleReset() {
    setError(null);
    if (newPassword.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setPageState("success");
      setTimeout(() => router.push("/auth/login"), 2500);
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="glass-card w-full max-w-md p-8 md:p-10"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="font-monotone text-4xl md:text-5xl text-gold mb-2 tracking-widest">ARMY</h1>
          <p className="text-[color:var(--text-muted)] text-sm tracking-widest uppercase">social network</p>
          <div className="w-16 h-px mx-auto mt-4" style={{ background: "linear-gradient(90deg, transparent, var(--accent-gold), transparent)" }} />
        </div>

        <AnimatePresence mode="wait">

          {/* Esperando el token */}
          {pageState === "waiting" && (
            <motion.div
              key="waiting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-4 py-6"
            >
              <div className="flex items-end gap-[3px] h-6">
                {[1, 2, 3, 4].map((i) => (
                  <motion.div
                    key={i}
                    className="w-[4px] rounded-full"
                    style={{ background: "var(--accent)" }}
                    animate={{ height: ["30%", "100%", "50%", "80%", "30%"] }}
                    transition={{ duration: 1, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
                  />
                ))}
              </div>
              <p className="text-[color:var(--text-secondary)] text-sm text-center">
                Verificando el link de recuperación...
              </p>
              <p className="text-[color:var(--text-muted)] text-xs text-center">
                Si este mensaje no desaparece, el link puede haber expirado.{" "}
                <button
                  type="button"
                  onClick={() => router.push("/auth/login")}
                  className="text-[color:var(--accent)] hover:underline"
                >
                  Volver al login
                </button>
              </p>
            </motion.div>
          )}

          {/* Form de nueva contraseña */}
          {pageState === "ready" && (
            <motion.div
              key="ready"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-col gap-3"
            >
              <h2 className="text-[color:var(--text-primary)] font-semibold text-center mb-2">
                Elegí tu nueva contraseña
              </h2>
              <input
                type="password"
                placeholder="Nueva contraseña"
                value={newPassword}
                onChange={(e) => { setNewPassword(e.target.value); setError(null); }}
                className="army-input w-full px-4 py-3 text-sm"
              />
              <input
                type="password"
                placeholder="Confirmar nueva contraseña"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setError(null); }}
                className="army-input w-full px-4 py-3 text-sm"
              />

              <AnimatePresence>
                {error && (
                  <motion.p
                    key="error"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-red-400 text-sm px-1"
                  >
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>

              <button
                type="button"
                onClick={handleReset}
                disabled={loading || !newPassword || !confirmPassword}
                className="btn-accent w-full py-3 text-sm mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Actualizando..." : "Guardar nueva contraseña"}
              </button>
            </motion.div>
          )}

          {/* Éxito */}
          {pageState === "success" && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-4 py-6"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 20, delay: 0.1 }}
                className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{ background: "rgba(var(--accent-rgb), 0.15)", border: "1px solid var(--accent)" }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7" style={{ color: "var(--accent)" }}>
                  <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 0 1 .208 1.04l-9 13.5a.75.75 0 0 1-1.154.114l-6-6a.75.75 0 0 1 1.06-1.06l5.353 5.353 8.493-12.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
                </svg>
              </motion.div>
              <p className="text-[color:var(--text-primary)] font-semibold text-center">
                ¡Contraseña actualizada!
              </p>
              <p className="text-[color:var(--text-muted)] text-sm text-center">
                Redirigiendo al inicio de sesión...
              </p>
            </motion.div>
          )}

        </AnimatePresence>
      </motion.div>
    </div>
  );
}
