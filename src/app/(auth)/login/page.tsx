"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase/browser";

function LoginPage() {
  const router = useRouter();
  type Mode = "login" | "register" | "forgot";
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const isRegister = mode === "register";
  const isForgot = mode === "forgot";

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
      setMode("login");
    }
    setLoading(false);
  }

  async function handleDemoLogin() {
    setDemoLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: "demo@socialarmy.app",
      password: "Demo1234!",
    });
    if (error) {
      setError("No se pudo iniciar la sesión demo. Intentá de nuevo.");
    } else {
      router.push("/");
    }
    setDemoLoading(false);
  }

  async function handleForgotPassword() {
    if (!email.trim()) {
      setError("Ingresá tu correo electrónico");
      return;
    }
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setMessage("¡Listo! Revisá tu email para resetear la contraseña.");
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
            onClick={() => { setMode("login"); setError(null); setMessage(null); }}
            className={`flex-1 py-2.5 text-sm font-medium transition-all duration-200 ${
              mode === "login"
                ? "bg-[var(--accent)] text-white shadow-[0_0_12px_var(--accent-glow)]"
                : "text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)]"
            }`}
          >
            Iniciar sesión
          </button>
          <button
            type="button"
            onClick={() => { setMode("register"); setError(null); setMessage(null); }}
            className={`flex-1 py-2.5 text-sm font-medium transition-all duration-200 ${
              mode === "register"
                ? "bg-[var(--accent)] text-white shadow-[0_0_12px_var(--accent-glow)]"
                : "text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)]"
            }`}
          >
            Registrarse
          </button>
        </div>

        {/* Form */}
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (isForgot) handleForgotPassword();
            else if (isRegister) handleRegister();
            else handleLogin();
          }}
          noValidate
        >
          <AnimatePresence>
            {isRegister && (
              <motion.div
                key="name-field"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <label htmlFor="login-name" className="sr-only">Tu nombre</label>
                <input
                  id="login-name"
                  type="text"
                  placeholder="Tu nombre"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="army-input w-full px-4 py-3 text-sm"
                />
              </motion.div>
            )}
          </AnimatePresence>

          <label htmlFor="login-email" className="sr-only">Email</label>
          <input
            id="login-email"
            type="email"
            placeholder="Email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="army-input w-full px-4 py-3 text-sm"
          />

          {!isForgot && (
            <>
              <label htmlFor="login-password" className="sr-only">Contraseña</label>
              <input
                id="login-password"
                type="password"
                placeholder="Contraseña"
                autoComplete={isRegister ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="army-input w-full px-4 py-3 text-sm"
              />
            </>
          )}

          <AnimatePresence mode="wait">
            {error && (
              <motion.p
                key="error"
                role="alert"
                aria-live="assertive"
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
                role="status"
                aria-live="polite"
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
            type="submit"
            disabled={loading}
            className="btn-accent w-full py-3 text-sm mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading
              ? isForgot ? "Enviando..." : isRegister ? "Creando cuenta..." : "Entrando..."
              : isForgot ? "Enviar link de recuperación" : isRegister ? "Crear cuenta" : "Entrar al Army"}
          </button>

          {!isForgot && !isRegister && (
            <button
              type="button"
              onClick={() => { setMode("forgot"); setError(null); setMessage(null); }}
              className="text-center text-xs text-[color:var(--text-muted)] hover:text-[color:var(--accent)] transition-colors mt-1"
            >
              ¿Olvidaste tu contraseña?
            </button>
          )}

          {isForgot && (
            <button
              type="button"
              onClick={() => { setMode("login"); setError(null); setMessage(null); }}
              className="text-center text-xs text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)] transition-colors mt-1"
            >
              ← Volver al inicio de sesión
            </button>
          )}
        </form>

        {/* Divisor */}
        <div className="flex items-center gap-3 mt-6">
          <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
          <span className="text-xs text-[color:var(--text-muted)]">o</span>
          <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
        </div>

        {/* Demo button */}
        <button
          type="button"
          onClick={handleDemoLogin}
          disabled={demoLoading}
          className="w-full mt-4 py-3 text-sm rounded-xl font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.12)",
            color: "var(--text-secondary)",
          }}
        >
          {demoLoading ? "Entrando..." : "👀 Explorar como invitado"}
        </button>

        <p className="text-center text-[color:var(--text-muted)] text-xs mt-4">
          La red social exclusiva para el BTS Army 💜
        </p>
      </motion.div>
    </div>
  );
}

export default LoginPage;
