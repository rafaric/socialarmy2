import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import ProfileView from "@/components/ProfileView";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
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
    .select("*, profiles(id, name, avatar)")
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