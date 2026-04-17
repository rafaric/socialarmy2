"use client";

import { useRef } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { useStickers, useUploadSticker } from "@/hooks/useStickers";
import { toast } from "sonner";

interface StickerPickerProps {
  userId: string;
  onSelect: (url: string) => void;
  onClose: () => void;
}

export default function StickerPicker({ userId, onSelect, onClose }: StickerPickerProps) {
  const { data: stickers = [], isLoading } = useStickers();
  const upload = useUploadSticker();
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/webp", "image/gif", "image/jpeg"].includes(file.type)) {
      toast.error("Solo PNG, WebP, GIF o JPG");
      return;
    }
    if (file.size > 512 * 1024) {
      toast.error("Máximo 512 KB");
      return;
    }
    try {
      const url = await upload.mutateAsync({ file, userId });
      toast.success("Sticker subido 🎉");
      onSelect(url);
      onClose();
    } catch {
      toast.error("Error al subir el sticker");
    }
    e.target.value = "";
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 6 }}
        transition={{ duration: 0.15 }}
        className="absolute bottom-full left-0 mb-2 z-30 glass-card p-3 w-64"
        style={{ maxHeight: 280, overflowY: "auto" }}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-[color:var(--text-secondary)]">Stickers</span>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={upload.isPending}
            className="text-[10px] px-2 py-1 rounded-lg transition-colors disabled:opacity-50"
            style={{ background: "var(--accent)20", color: "var(--accent)" }}
          >
            {upload.isPending ? "Subiendo..." : "+ Subir"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/webp,image/gif,image/jpeg"
            className="hidden"
            onChange={handleFile}
          />
        </div>

        {isLoading ? (
          <div className="grid grid-cols-4 gap-1.5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="skeleton aspect-square rounded-lg" />
            ))}
          </div>
        ) : stickers.length === 0 ? (
          <p className="text-xs text-center text-[color:var(--text-muted)] py-6">
            Sin stickers aún.<br />¡Subí el primero!
          </p>
        ) : (
          <div className="grid grid-cols-4 gap-1.5">
            {stickers.map((s) => (
              <motion.button
                key={s.id}
                type="button"
                whileHover={{ scale: 1.12 }}
                whileTap={{ scale: 0.92 }}
                onClick={() => { onSelect(s.url); onClose(); }}
                className="aspect-square rounded-lg overflow-hidden bg-white/5 hover:bg-white/10 transition-colors relative"
                title={s.name ?? undefined}
              >
                <Image src={s.url} alt={s.name ?? "sticker"} fill sizes="56px" className="object-contain p-0.5" />
              </motion.button>
            ))}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
