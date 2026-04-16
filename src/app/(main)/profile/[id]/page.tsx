import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import ProfileView from "@/components/ProfileView";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("name, avatar, about")
    .eq("id", id)
    .single();

  if (!profile) return { title: "Perfil no encontrado" };

  const description = profile.about
    ? `${profile.about.slice(0, 140)}${profile.about.length > 140 ? "..." : ""}`
    : `Perfil de ${profile.name} en Social Army`;

  return {
    title: profile.name,
    description,
    openGraph: {
      title: `${profile.name} · Social Army`,
      description,
      images: profile.avatar ? [{ url: profile.avatar, alt: `Avatar de ${profile.name}` }] : [],
      type: "profile",
    },
    twitter: {
      card: "summary",
      title: `${profile.name} · Social Army`,
      description,
      images: profile.avatar ? [profile.avatar] : [],
    },
  };
}

export default async function ProfilePage({ params, searchParams }: Props) {
  const { id } = await params;
  const { tab = "about" } = await searchParams;

  const supabase = await createClient();

  // Fetch profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .single();

  if (!profile) {
    notFound();
  }

  // Fetch posts
  const { data: posts } = await supabase
    .from("posts")
    .select("id, content, created_at, author, photos, tagged, parent, era, now_playing, bts_members, profiles!posts_author_fkey(id, name, avatar)")
    .is("parent", null)
    .eq("author", id)
    .order("created_at", { ascending: false });

  // Fetch friends
  const { data: friendRows } = await supabase
    .from("friends")
    .select("friend_id")
    .eq("user_id", id);

  const friendIds = friendRows?.map((f) => f.friend_id) ?? [];
  let friends: { id: string; name: string; avatar: string }[] = [];
  if (friendIds.length > 0) {
    const { data: friendProfiles } = await supabase
      .from("profiles")
      .select("id, name, avatar")
      .in("id", friendIds);
    friends = friendProfiles ?? [];
  }

  // Fetch photos
  const { data: postsWithPhotos } = await supabase
    .from("posts")
    .select("photos")
    .eq("author", id)
    .not("photos", "eq", null);

  const photos = postsWithPhotos?.filter((p) => p.photos && p.photos.length > 0) ?? [];

  // Get current user
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  return (
    <ProfileView
      profile={profile}
      posts={posts ?? []}
      friends={friends}
      photos={photos}
      currentUserId={currentUser?.id ?? null}
      initialTab={tab}
    />
  );
}