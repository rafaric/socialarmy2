"use client";

import { useDroppable } from "@dnd-kit/core";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface CardDropZoneProps {
  id: string;
  variant: "market" | "offer";
  listingId?: string;
  label: string;
  data?: Record<string, unknown>;
  className?: string;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export default function CardDropZone({
  id,
  variant,
  label,
  data,
  className,
}: CardDropZoneProps) {
  const { isOver, setNodeRef } = useDroppable({ id, data: data ?? {} });

  const isMarket = variant === "market";

  return (
    <div
      ref={setNodeRef}
      className={[
        "flex flex-col items-center justify-center gap-2",
        "rounded-xl border-2 border-dashed transition-all duration-200 p-6 text-center",
        isOver
          ? "border-[color:var(--accent)] bg-[color:var(--accent)]/10 scale-[1.02]"
          : "border-[color:var(--border)] bg-transparent",
        className ?? "",
      ].join(" ")}
    >
      {/* Icono */}
      <span className="text-2xl" aria-hidden="true">
        {isMarket ? "🏪" : "🤝"}
      </span>

      {/* Etiqueta */}
      <p
        className="text-xs font-semibold transition-colors"
        style={{ color: isOver ? "var(--accent)" : "var(--text-muted)" }}
      >
        {label}
      </p>

      {/* Hint */}
      <p className="text-[10px]" style={{ color: "var(--text-muted)", opacity: 0.7 }}>
        {isMarket ? "Arrastrá una carta acá" : "Soltá para ofertar"}
      </p>
    </div>
  );
}
