import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";

const BASE_URL = "https://socialarmy.vercel.app";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();

  const [{ data: profiles }, { data: posts }] = await Promise.all([
    supabase.from("profiles").select("id, updated_at").limit(1000),
    supabase
      .from("posts")
      .select("id, created_at")
      .is("parent", null)
      .order("created_at", { ascending: false })
      .limit(1000),
  ]);

  const profileUrls: MetadataRoute.Sitemap = (profiles ?? []).map((p) => ({
    url: `${BASE_URL}/profile/${p.id}`,
    lastModified: p.updated_at ? new Date(p.updated_at) : new Date(),
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const postUrls: MetadataRoute.Sitemap = (posts ?? []).map((p) => ({
    url: `${BASE_URL}/post/${p.id}`,
    lastModified: new Date(p.created_at),
    changeFrequency: "never",
    priority: 0.5,
  }));

  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    ...profileUrls,
    ...postUrls,
  ];
}
