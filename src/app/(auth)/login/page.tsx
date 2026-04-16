"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/browser";
import Card from "@/components/Card";

function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

  return (
    <Card type="login">
      <h1 className="text-center text-purple-600 pt-6 md:text-7xl leading-10 text-3xl font-monotone">
        Bienvenidos a SocialArmy
      </h1>
      <h2 className="text-center text-2xl">
        La red social exclusiva para el BTS Army
      </h2>
      <div className="flex flex-col gap-3 w-full max-w-sm">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border border-purple-300 rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400"
        />
        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border border-purple-300 rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400"
        />
        {error && <p className="text-red-500 text-sm">{error}</p>}
      </div>
      <button
        type="button"
        disabled={loading}
        className="rounded-md bg-purple-500 text-white py-6 px-4 hover:text-black hover:shadow-[10px_10px_23px_-7px_rgba(82,0,64,0.75)] hover:bg-purple-200 hover:scale-110 hover:transition-all duration-500 disabled:opacity-50"
        onClick={handleLogin}
      >
        {loading ? "Entrando..." : "Entrar"}
      </button>
    </Card>
  );
}

export default LoginPage;
