import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import PostDetailClient from "./PostDetailClient";

interface Props {
  params: Promise<{ id: string }>;
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
