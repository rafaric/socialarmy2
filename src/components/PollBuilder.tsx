"use client";

import { useState } from "react";

export interface PollDraft {
  question: string;
  options: string[];
  duration: number; // days
}

interface Props {
  value: PollDraft;
  onChange: (v: PollDraft) => void;
}

const DURATIONS = [
  { days: 1, label: "1 día" },
  { days: 3, label: "3 días" },
  { days: 7, label: "7 días" },
];

export default function PollBuilder({ value, onChange }: Props) {
  function setQuestion(q: string) {
    onChange({ ...value, question: q });
  }

  function setOption(i: number, text: string) {
    const opts = [...value.options];
    opts[i] = text;
    onChange({ ...value, options: opts });
  }

  function addOption() {
    if (value.options.length >= 4) return;
    onChange({ ...value, options: [...value.options, ""] });
  }

  function removeOption(i: number) {
    if (value.options.length <= 2) return;
    onChange({ ...value, options: value.options.filter((_, idx) => idx !== i) });
  }

  return (
    <div className="flex flex-col gap-3 p-3 rounded-xl border border-white/10 bg-white/3">
      {/* Question */}
      <input
        type="text"
        value={value.question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Pregunta de la encuesta…"
        maxLength={120}
        className="army-input px-3 py-2 text-sm w-full"
        aria-label="Pregunta"
      />

      {/* Options */}
      <div className="flex flex-col gap-2">
        {value.options.map((opt, i) => (
          <div key={i} className="flex gap-2 items-center">
            <span className="text-xs text-[color:var(--text-muted)] w-4 shrink-0 text-center">{i + 1}</span>
            <input
              type="text"
              value={opt}
              onChange={(e) => setOption(i, e.target.value)}
              placeholder={`Opción ${i + 1}${i < 2 ? " (requerida)" : ""}`}
              maxLength={60}
              className="army-input px-3 py-1.5 text-sm flex-1"
            />
            {value.options.length > 2 && (
              <button
                type="button"
                onClick={() => removeOption(i)}
                className="text-[color:var(--text-muted)] hover:text-red-400 transition-colors shrink-0"
                aria-label="Eliminar opción"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                </svg>
              </button>
            )}
          </div>
        ))}

        {value.options.length < 4 && (
          <button
            type="button"
            onClick={addOption}
            className="text-xs text-[color:var(--accent)] hover:underline text-left pl-6"
          >
            + Agregar opción
          </button>
        )}
      </div>

      {/* Duration */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-[color:var(--text-muted)] shrink-0">Duración:</span>
        <div className="flex gap-1.5">
          {DURATIONS.map((d) => (
            <button
              key={d.days}
              type="button"
              onClick={() => onChange({ ...value, duration: d.days })}
              className="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
              style={{
                background: value.duration === d.days ? "var(--accent)" : "rgba(255,255,255,0.06)",
                color: value.duration === d.days ? "#fff" : "var(--text-muted)",
              }}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
