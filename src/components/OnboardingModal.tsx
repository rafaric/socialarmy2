"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { supabase } from "@/lib/supabase/browser";
import { BTS_MEMBERS, getMemberByKey } from "@/lib/bts-members";
import { BTS_DISCOGRAPHY } from "@/lib/bts-discography";
import type { Profile } from "@/types";

interface OnboardingModalProps {
  profile: Profile;
  userId: string;
}

const STORAGE_KEY = (userId: string) => `onboarding_done_${userId}`;

function isProfileEmpty(profile: Profile) {
  return !profile.bias && !profile.fav_album && !profile.about;
}

type Step = 1 | 2;

export default function OnboardingModal({ profile, userId }: OnboardingModalProps) {
  const [visible, setVisible] = useState(false);
  const trapRef = useFocusTrap<HTMLDivElement>(visible);
  const [step, setStep] = useState<Step>(1);
  const [about, setAbout] = useState("");
  const [bias, setBias] = useState<string | null>(null);
  const [favAlbum, setFavAlbum] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const done = localStorage.getItem(STORAGE_KEY(userId));
    if (!done && isProfileEmpty(profile)) {
      // Pequeño delay para que el usuario vea el home primero
      const t = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(t);
    }
  }, [userId, profile]);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY(userId), "1");
    setVisible(false);
  }

  async function handleSave() {
    setSaving(true);
    await supabase.from("profiles").update({
      about: about.trim() || null,
      bias: bias || null,
      fav_album: favAlbum || null,
    }).eq("id", userId);
    setSaving(false);
    dismiss();
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="onboarding-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}
        >
          <motion.div
            ref={trapRef}
            key="onboarding-panel"
            role="dialog"
            aria-modal="true"
            aria-label={step === 1 ? "Bienvenida al Army" : "Tus favoritos BTS"}
            initial={{ opacity: 0, scale: 0.93, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.93, y: 12 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="glass-card w-full max-w-md p-7"
          >
            {/* Header */}
            <div className="text-center mb-6">
              <div className="text-3xl mb-2">💜</div>
              <h2 className="text-lg font-bold text-[color:var(--text-primary)]">
                {step === 1 ? "¡Bienvenida al Army!" : "Tus favoritos BTS"}
              </h2>
              <p className="text-sm text-[color:var(--text-muted)] mt-1">
                {step === 1
                  ? "Completá tu perfil para que el Army te conozca"
                  : "Elegí tu bias y álbum favorito"}
              </p>
            </div>

            {/* Step indicators */}
            <div className="flex justify-center gap-2 mb-6">
              {([1, 2] as Step[]).map((s) => (
                <div
                  key={s}
                  className="h-1.5 rounded-full transition-all duration-300"
                  style={{
                    width: s === step ? 24 : 8,
                    background: s === step ? "var(--accent)" : "rgba(255,255,255,0.15)",
                  }}
                />
              ))}
            </div>

            <AnimatePresence mode="wait">

              {/* Step 1 — Bio */}
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-col gap-4"
                >
                  <div>
                    <label htmlFor="onboarding-about" className="text-[10px] text-[color:var(--text-muted)] uppercase tracking-wider block mb-2">
                      Descripción
                    </label>
                    <textarea
                      id="onboarding-about"
                      rows={3}
                      placeholder="¿Quién sos en el Army? Contanos algo sobre vos..."
                      value={about}
                      onChange={(e) => setAbout(e.target.value)}
                      className="army-input w-full px-4 py-3 text-sm resize-none rounded-xl"
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={dismiss}
                      className="flex-1 py-2.5 text-sm rounded-xl text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)] hover:bg-white/10 transition-colors font-medium"
                    >
                      Saltar por ahora
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="flex-1 btn-accent py-2.5 text-sm"
                    >
                      Siguiente →
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Step 2 — Bias + Álbum */}
              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-col gap-5"
                >
                  {/* Bias selector */}
                  <div>
                    <label className="text-[10px] text-[color:var(--text-muted)] uppercase tracking-wider block mb-3">
                      Tu bias
                    </label>
                    <div className="flex gap-2.5 flex-wrap justify-center">
                      {BTS_MEMBERS.map((member) => {
                        const isSelected = bias === member.key;
                        return (
                          <motion.button
                            key={member.key}
                            type="button"
                            whileHover={{ scale: 1.06 }}
                            whileTap={{ scale: 0.94 }}
                            onClick={() => setBias(isSelected ? null : member.key)}
                            className="flex flex-col items-center gap-1 relative"
                          >
                            <div
                              className="w-11 h-11 rounded-full overflow-hidden transition-all duration-200"
                              style={{
                                outline: isSelected ? `2px solid ${member.color}` : "2px solid transparent",
                                outlineOffset: "2px",
                                boxShadow: isSelected ? `0 0 10px ${member.color}60` : "none",
                              }}
                            >
                              <Image src={member.photo} alt={member.name} width={44} height={44} className="w-full h-full object-cover object-top" sizes="44px" />
                            </div>
                            <span className="text-[10px]" style={{ color: isSelected ? member.color : "var(--text-muted)" }}>
                              {member.name}
                            </span>
                            <AnimatePresence>
                              {isSelected && (
                                <motion.span
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  exit={{ scale: 0 }}
                                  className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center text-white text-[8px] font-bold"
                                  style={{ background: member.color }}
                                >
                                  ✓
                                </motion.span>
                              )}
                            </AnimatePresence>
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Álbum favorito */}
                  <div>
                    <label className="text-[10px] text-[color:var(--text-muted)] uppercase tracking-wider block mb-2">
                      Álbum favorito
                    </label>
                    <div className="flex items-center gap-2">
                      <AnimatePresence>
                        {favAlbum && (
                          <motion.div
                            key={favAlbum}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            className="shrink-0"
                          >
                            <Image
                              src={BTS_DISCOGRAPHY.find(a => a.key === favAlbum)?.cover ?? ""}
                              alt={`Portada de ${BTS_DISCOGRAPHY.find(a => a.key === favAlbum)?.title ?? "álbum"}`}
                              width={40}
                              height={40}
                              className="w-10 h-10 rounded-lg object-cover"
                              sizes="40px"
                            />
                          </motion.div>
                        )}
                      </AnimatePresence>
                      <select
                        value={favAlbum}
                        onChange={(e) => setFavAlbum(e.target.value)}
                        className="army-input flex-1 px-3 py-2.5 text-sm rounded-lg appearance-none cursor-pointer"
                      >
                        <option value="">Elegir álbum...</option>
                        {BTS_DISCOGRAPHY.map((album) => (
                          <option key={album.key} value={album.key}>
                            {album.title} ({album.year})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="px-4 py-2.5 text-sm rounded-xl text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)] hover:bg-white/10 transition-colors font-medium"
                    >
                      ← Atrás
                    </button>
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={saving}
                      className="flex-1 btn-accent py-2.5 text-sm disabled:opacity-50"
                    >
                      {saving ? "Guardando..." : "Guardar y empezar 💜"}
                    </button>
                  </div>
                </motion.div>
              )}

            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
