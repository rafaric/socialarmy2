"use client";

import { useTheme } from "./ThemeProvider";

const ERAS = [
  { key: "arirang", label: "Arirang",   dot: "#cc2936" },
  { key: "butter",  label: "Butter",    dot: "#f9d342" },
  { key: "mots7",   label: "MOTS:7",    dot: "#1e64c8" },
] as const;

export default function EraSelector() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="glass-card py-4 px-4">
      <p className="text-[10px] tracking-[0.25em] text-[color:var(--text-muted)] uppercase mb-3">Era activa</p>
      <div className="flex flex-col gap-1.5">
        {ERAS.map((era) => (
          <button
            key={era.key}
            type="button"
            onClick={() => setTheme(era.key)}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
              theme === era.key
                ? "bg-white/10 text-[color:var(--text-primary)] font-medium"
                : "text-[color:var(--text-muted)] hover:text-[color:var(--text-secondary)] hover:bg-white/5"
            }`}
          >
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0 transition-all duration-300"
              style={{
                background: era.dot,
                boxShadow: theme === era.key ? `0 0 8px ${era.dot}` : "none",
              }}
            />
            {era.label}
          </button>
        ))}
      </div>
    </div>
  );
}
