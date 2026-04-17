"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getNextEvent, getArgentinaEvent } from "@/lib/bts-events";

interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  past: boolean;
}

function calcCountdown(targetDate: string): Countdown {
  const target = new Date(`${targetDate}T00:00:00`).getTime();
  const now = Date.now();
  const diff = target - now;

  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, past: true };

  const days    = Math.floor(diff / 86_400_000);
  const hours   = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  const seconds = Math.floor((diff % 60_000) / 1_000);
  return { days, hours, minutes, seconds, past: false };
}

function CountdownDisplay({ date, accent }: { date: string; accent: string }) {
  const [cd, setCd] = useState<Countdown>(() => calcCountdown(date));

  useEffect(() => {
    const id = setInterval(() => setCd(calcCountdown(date)), 1000);
    return () => clearInterval(id);
  }, [date]);

  if (cd.past) return <p className="text-xs text-[color:var(--text-muted)]">¡Ya pasó! 💜</p>;

  return (
    <div className="flex gap-2 mt-2">
      {[
        { v: cd.days,    l: "días" },
        { v: cd.hours,   l: "hs" },
        { v: cd.minutes, l: "min" },
        { v: cd.seconds, l: "seg" },
      ].map(({ v, l }) => (
        <div key={l} className="flex-1 flex flex-col items-center rounded-lg py-1.5" style={{ background: `${accent}15` }}>
          <span className="text-lg font-bold tabular-nums leading-none" style={{ color: accent }}>
            {String(v).padStart(2, "0")}
          </span>
          <span className="text-[9px] text-[color:var(--text-muted)] mt-0.5 uppercase tracking-wide">{l}</span>
        </div>
      ))}
    </div>
  );
}

export default function EventsCard() {
  const nextEvent   = getNextEvent();
  const argEvent    = getArgentinaEvent();
  const nextDate    = nextEvent?.dates.find((d) => d >= new Date().toISOString().slice(0, 10)) ?? null;
  const argDate     = argEvent?.dates[0] ?? null;

  return (
    <div className="glass-card p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-[color:var(--text-muted)]">Eventos</span>
        <Link href="/events" className="text-xs text-[color:var(--accent)] hover:underline">
          Ver todos
        </Link>
      </div>

      {/* Próximo show */}
      {nextEvent && nextDate ? (
        <div>
          <p className="text-[10px] text-[color:var(--text-muted)] uppercase tracking-widest mb-1">Próximo show</p>
          <div className="flex items-center gap-1.5">
            <span className="text-base">{nextEvent.flag}</span>
            <div>
              <p className="text-xs font-semibold text-[color:var(--text-primary)] leading-tight">{nextEvent.city}</p>
              <p className="text-[10px] text-[color:var(--text-muted)]">{nextDate}</p>
            </div>
          </div>
          <CountdownDisplay date={nextDate} accent="var(--accent)" />
        </div>
      ) : (
        <p className="text-xs text-[color:var(--text-muted)]">No hay shows próximos</p>
      )}

      {/* Divisor */}
      <div className="border-t border-white/10" />

      {/* Argentina */}
      {argEvent && argDate && (
        <div>
          <p className="text-[10px] text-[color:var(--text-muted)] uppercase tracking-widest mb-1">🇦🇷 Argentina — primer recital</p>
          <div className="flex items-center gap-1.5">
            <div>
              <p className="text-xs font-semibold text-[color:var(--text-primary)] leading-tight">{argEvent.venue}</p>
              <p className="text-[10px] text-[color:var(--text-muted)]">{argEvent.city} · {argDate}</p>
            </div>
          </div>
          <CountdownDisplay date={argDate} accent="#cc2936" />
        </div>
      )}
    </div>
  );
}
