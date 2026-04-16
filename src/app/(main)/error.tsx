"use client";

import { useEffect } from "react";
import Link from "next/link";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function MainError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error("[MainError]", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-4">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
        style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}
      >
        <span className="text-3xl" role="img" aria-label="Error">⚠️</span>
      </div>

      <h2 className="text-lg font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
        Algo salió mal
      </h2>
      <p className="text-sm mb-6 max-w-xs" style={{ color: "var(--text-muted)" }}>
        Ocurrió un error inesperado. Podés intentar recargar la sección.
      </p>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="btn-accent py-2 px-5 text-sm"
        >
          Reintentar
        </button>
        <Link
          href="/"
          className="py-2 px-5 text-sm rounded-xl border transition-colors"
          style={{ color: "var(--text-muted)", borderColor: "var(--glass-border)" }}
        >
          Ir al inicio
        </Link>
      </div>
    </div>
  );
}
