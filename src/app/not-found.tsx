import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Página no encontrada",
  description: "La página que buscás no existe.",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <html lang="es">
      <body>
        <main
          className="min-h-screen flex flex-col items-center justify-center px-4 text-center"
          style={{ background: "var(--bg-deep)" }}
        >
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6"
            style={{ background: "var(--accent-glow)", border: "1px solid var(--glass-border)" }}
          >
            <span className="text-4xl" role="img" aria-label="Cara triste">😢</span>
          </div>

          <h1 className="text-6xl font-bold mb-3" style={{ color: "var(--accent)" }}>
            404
          </h1>
          <p className="text-xl font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
            Página no encontrada
          </p>
          <p className="text-sm mb-8 max-w-xs" style={{ color: "var(--text-muted)" }}>
            La página que buscás no existe o fue eliminada.
          </p>

          <Link
            href="/"
            className="btn-accent py-2.5 px-6 text-sm font-medium"
          >
            Volver al inicio
          </Link>
        </main>
      </body>
    </html>
  );
}
