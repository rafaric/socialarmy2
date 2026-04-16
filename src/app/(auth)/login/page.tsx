"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase/browser";

function LoginPage() {
  const router = useRouter();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleLogin() {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
    } else {
      router.push("/");
    }
    setLoading(false);
  }

  async function handleRegister() {
    if (!name.trim()) {
      setError("El nombre es requerido");
      return;
    }
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    if (error) {
      setError(error.message);
    } else {
      setMessage("¡Registro exitoso! Revisá tu email para confirmar.");
      setIsRegister(false);
    }
    setLoading(false);
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
          <h1 className="font-monotone text-4xl md:text-5xl text-gold mb-2 tracking-widest">
            ARMY
          </h1>
          <p className="text-[color:var(--text-muted)] text-sm tracking-widest uppercase">
            social network
          </p>
          <div className="w-16 h-px mx-auto mt-4" style={{ background: "linear-gradient(90deg, transparent, var(--accent-gold), transparent)" }} />
        </div>

        {/* Mode toggle */}
        <div className="flex rounded-lg overflow-hidden border border-white/10 mb-8">
          <button
            type="button"
            onClick={() => { setIsRegister(false); setError(null); setMessage(null); }}
            className={`flex-1 py-2.5 text-sm font-medium transition-all duration-200 ${
              !isRegister
                ? "bg-[var(--accent)] text-white shadow-[0_0_12px_var(--accent-glow)]"
                : "text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)]"
            }`}
          >
            Iniciar sesión
          </button>
          <button
            type="button"
            onClick={() => { setIsRegister(true); setError(null); setMessage(null); }}
            className={`flex-1 py-2.5 text-sm font-medium transition-all duration-200 ${
              isRegister
                ? "bg-[var(--accent)] text-white shadow-[0_0_12px_var(--accent-glow)]"
                : "text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)]"
            }`}
          >
            Registrarse
          </button>
        </div>

        {/* Form */}
        <div className="flex flex-col gap-3">
          <AnimatePresence>
            {isRegister && (
              <motion.input
                key="name"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                type="text"
                placeholder="Tu nombre"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="army-input w-full px-4 py-3 text-sm"
              />
            )}
          </AnimatePresence>

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="army-input w-full px-4 py-3 text-sm"
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="army-input w-full px-4 py-3 text-sm"
          />

          <AnimatePresence mode="wait">
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
            {message && (
              <motion.p
                key="message"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-emerald-400 text-sm px-1"
              >
                {message}
              </motion.p>
            )}
          </AnimatePresence>

          <button
            type="button"
            disabled={loading}
            onClick={isRegister ? handleRegister : handleLogin}
            className="btn-accent w-full py-3 text-sm mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading
              ? isRegister ? "Creando cuenta..." : "Entrando..."
              : isRegister ? "Crear cuenta" : "Entrar al Army"}
          </button>
        </div>

        <p className="text-center text-[color:var(--text-muted)] text-xs mt-6">
          La red social exclusiva para el BTS Army 💜
        </p>
      </motion.div>
    </div>
  );
}

export default LoginPage;
