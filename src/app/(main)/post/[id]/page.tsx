import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import PostDetailClient from "./PostDetailClient";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data: post } = await supabase
    .from("posts")
    .select("content, photos, profiles!posts_author_fkey(name)")
    .eq("id", id)
    .single();

  if (!post) return { title: "Post no encontrado" };

  const authorName = Array.isArray(post.profiles)
    ? post.profiles[0]?.name
    : (post.profiles as { name: string } | null)?.name;

  const snippet = post.content.slice(0, 140) + (post.content.length > 140 ? "..." : "");
  const title = `${authorName ?? "ARMY"}: "${snippet}"`;
  const firstPhoto = (post.photos as { url: string }[] | null)?.[0]?.url;

  return {
    title,
    description: snippet,
    openGraph: {
      title,
      description: snippet,
      type: "article",
      images: firstPhoto ? [{ url: firstPhoto, alt: `Foto del post de ${authorName}` }] : [],
    },
    twitter: {
      card: firstPhoto ? "summary_large_image" : "summary",
      title,
      description: snippet,
      images: firstPhoto ? [firstPhoto] : [],
    },
  };
}

export default async function PostPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: post } = await supabase
    .from("posts")
    .select("id, content, created_at, author, photos, tagged, parent, era, now_playing, bts_members, profiles!posts_author_fkey(id, name, avatar)")
    .eq("id", id)
    .single();

  if (!post) notFound();

  return <PostDetailClient post={post} />;
}
