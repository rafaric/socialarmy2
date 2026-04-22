import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/browser";
import type { Profile } from "@/types";

interface PostResult {
  id: string;
  content: string;
  created_at: string;
  author: string;
  era: string | null;
  bts_members: string[] | null;
  profiles: { id: string; name: string; avatar: string } | { id: string; name: string; avatar: string }[] | null;
}

export function useDebounce(value: string, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function useSearchProfiles(query: string, blockedIds: string[] = []) {
  return useQuery({
    queryKey: ["search-profiles", query, blockedIds],
    queryFn: async (): Promise<Profile[]> => {
      let q = supabase
        .from("profiles")
        .select("id, name, avatar, bias, fav_album")
        .ilike("name", `%${query}%`)
        .limit(20);
      if (blockedIds.length > 0) {
        q = q.not("id", "in", `(${blockedIds.join(",")})`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
    enabled: query.length >= 2,
    staleTime: 30_000,
  });
}

export function useSearchPosts(query: string, blockedIds: string[] = []) {
  return useQuery({
    queryKey: ["search-posts", query, blockedIds],
    queryFn: async (): Promise<PostResult[]> => {
      let q = supabase
        .from("posts")
        .select("id, content, created_at, author, era, bts_members, profiles!posts_author_fkey(id, name, avatar)")
        .ilike("content", `%${query}%`)
        .is("parent", null)
        .order("created_at", { ascending: false })
        .limit(20);
      if (blockedIds.length > 0) {
        q = q.not("author", "in", `(${blockedIds.join(",")})`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as PostResult[];
    },
    enabled: query.length >= 2,
    staleTime: 30_000,
  });
}
