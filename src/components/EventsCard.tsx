"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getTodayEvent, getNextEvent, getArgentinaEvent } from "@/lib/bts-events";

interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  past: boolean;
}

function calcCountdown(targetDate: string): Countdown {
  const target = new Date(`${targetDate}T00:00:00`).getTime();
  const diff = target - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, past: true };
  return {
    days:    Math.floor(diff / 86_400_000),
    hours:   Math.floor((diff % 86_400_000) / 3_600_000),
    minutes: Math.floor((diff % 3_600_000) / 60_000),
    seconds: Math.floor((diff % 60_000) / 1_000),
    past: false,
  };
}

function CountdownDisplay({ date, accent }: { date: string; accent: string }) {
  const [cd, setCd] = useState<Countdown>(() => calcCountdown(date));
  useEffect(() => {
    const id = setInterval(() => setCd(calcCountdown(date)), 1000);
    return () => clearInterval(id);
  }, [date]);

  if (cd.past) return <p className="text-xs text-[color:var(--text-muted)] mt-1">¡Ya pasó! 💜</p>;

  return (
    <div className="flex gap-1.5 mt-2">
      {[
        { v: cd.days, l: "días" },
        { v: cd.hours, l: "hs" },
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

function formatShortDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("es-AR", { day: "numeric", month: "short" });
}

function EventRow({
  flag, city, date, label, accent, badge,
}: {
  flag: string; city: string; date: string;
  label: string; accent: string; badge?: string;
}) {
  return (
    <div>
      <p className="text-[10px] text-[color:var(--text-muted)] uppercase tracking-widest mb-1">{label}</p>
      <div className="flex items-center gap-1.5">
        <span className="text-base">{flag}</span>
        <div>
          <p className="text-xs font-semibold text-[color:var(--text-primary)] leading-tight flex items-center gap-1.5">
            {city}
            {badge && (
              <span className="text-[10px] px-1.5 py-0.5 rounded font-bold" style={{ background: `${accent}22`, color: accent }}>
                {badge}
              </span>
            )}
          </p>
          <p className="text-[10px] text-[color:var(--text-muted)]">{formatShortDate(date)}</p>
        </div>
      </div>
      <CountdownDisplay date={date} accent={accent} />
    </div>
  );
}

export default function EventsCard() {
  const today   = new Date().toISOString().slice(0, 10);
  const todayEv = getTodayEvent();
  const nextEv  = getNextEvent();
  const argEv   = getArgentinaEvent();

  const nextDate = nextEv?.dates.find((d) => d > today) ?? null;
  const argDate  = argEv?.dates[0] ?? null;

  // Si el próximo es el mismo que el de hoy (múltiples fechas), no duplicar
  const showNext = nextEv && nextDate && nextEv.id !== todayEv?.id;

  return (
    <div className="glass-card p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-[color:var(--text-muted)]">Eventos</span>
        <Link href="/events" className="text-xs text-[color:var(--accent)] hover:underline">Ver todos</Link>
      </div>

      {/* Show de hoy */}
      {todayEv && (
        <EventRow
          flag={todayEv.flag}
          city={todayEv.city}
          date={today}
          label="Hoy"
          accent="var(--accent)"
          badge="HOY"
        />
      )}

      {/* Próximo show */}
      {showNext && nextDate ? (
        <>
          {todayEv && <div className="border-t border-white/10" />}
          <EventRow
            flag={nextEv.flag}
            city={nextEv.city}
            date={nextDate}
            label="Próximo show"
            accent="var(--accent)"
          />
        </>
      ) : !todayEv && (
        <p className="text-xs text-[color:var(--text-muted)]">No hay shows próximos</p>
      )}

      {/* Argentina */}
      {argEv && argDate && (
        <>
          <div className="border-t border-white/10" />
          <EventRow
            flag="🇦🇷"
            city={argEv.city}
            date={argDate}
            label="Argentina — primer recital"
            accent="#cc2936"
          />
        </>
      )}
    </div>
  );
}
