"use client";

import { useEffect } from "react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log error to console in development
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <html lang="es">
      <body>
        <main
          className="min-h-screen flex flex-col items-center justify-center px-4 text-center"
          style={{ background: "var(--bg-deep)" }}
        >
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6"
            style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}
          >
            <span className="text-4xl" role="img" aria-label="Error">⚠️</span>
          </div>

          <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
            Algo salió mal
          </h1>
          <p className="text-sm mb-8 max-w-xs" style={{ color: "var(--text-muted)" }}>
            Ocurrió un error inesperado. Podés intentar recargar la página.
          </p>

          <button
            type="button"
            onClick={reset}
            className="btn-accent py-2.5 px-6 text-sm font-medium"
          >
            Reintentar
          </button>
        </main>
      </body>
    </html>
  );
}
