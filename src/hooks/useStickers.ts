"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/browser";
import type { Sticker } from "@/types";

export function useStickers() {
  return useQuery<Sticker[]>({
    queryKey: ["stickers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stickers")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Sticker[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useUploadSticker() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ file, userId }: { file: File; userId: string }) => {
      const ext = file.name.split(".").pop() ?? "webp";
      const name = `${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("stickers")
        .upload(name, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("stickers").getPublicUrl(name);

      const { error: dbError } = await supabase.from("stickers").insert({
        url: urlData.publicUrl,
        uploaded_by: userId,
        name: file.name.replace(/\.[^.]+$/, ""),
      });
      if (dbError) throw dbError;

      return urlData.publicUrl;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stickers"] });
    },
  });
}
