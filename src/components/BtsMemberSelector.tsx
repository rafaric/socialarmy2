"use client";

import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { BTS_MEMBERS, getMemberByKey } from "@/lib/bts-members";

interface BtsMemberSelectorProps {
  value: string | null | undefined;
  onChange: (key: string | null) => void;
  label: string;
  readOnly?: boolean;
}

export default function BtsMemberSelector({ value, onChange, label, readOnly = false }: BtsMemberSelectorProps) {
  const selected = value ? getMemberByKey(value) : null;

  if (readOnly) {
    if (!selected) return null;
    return (
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-full overflow-hidden shrink-0"
          style={{ outline: `2px solid ${selected.color}`, outlineOffset: "2px", boxShadow: `0 0 8px ${selected.color}60` }}
        >
          <Image src={selected.photo} alt={selected.name} width={40} height={40} className="w-full h-full object-cover object-top" sizes="40px" />
        </div>
        <div>
          <p className="text-[10px] text-[color:var(--text-muted)] uppercase tracking-wider">{label}</p>
          <p className="text-sm font-semibold" style={{ color: selected.color }}>{selected.name}</p>
          <p className="text-xs text-[color:var(--text-muted)]">{selected.fullName}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="text-[10px] text-[color:var(--text-muted)] uppercase tracking-wider mb-2">{label}</p>
      <div className="flex gap-2 flex-wrap">
        {BTS_MEMBERS.map((member) => {
          const isSelected = value === member.key;
          return (
            <motion.button
              key={member.key}
              type="button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onChange(isSelected ? null : member.key)}
              className="flex flex-col items-center gap-1 relative"
            >
              <div
                className="w-12 h-12 rounded-full overflow-hidden transition-all duration-200"
                style={{
                  boxShadow: isSelected ? `0 0 12px ${member.color}80` : "none",
                  outline: isSelected ? `2px solid ${member.color}` : "2px solid transparent",
                  outlineOffset: "2px",
                }}
              >
                <Image src={member.photo} alt={member.name} width={48} height={48} className="w-full h-full object-cover object-top" sizes="48px" />
              </div>
              <span
                className="text-[10px] font-medium transition-colors"
                style={{ color: isSelected ? member.color : "var(--text-muted)" }}
              >
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
  );
}
