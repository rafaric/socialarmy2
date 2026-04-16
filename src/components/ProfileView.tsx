"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import Avatar from "@/components/Avatar";
import ArmySinceBadge from "@/components/ArmySinceBadge";
import PostsCard from "@/components/PostsCard";
import { supabase } from "@/lib/supabase/browser";
import { useAuthStore } from "@/store/useAuthStore";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { Profile, Photo, TaggedFriend } from "@/types";

interface ProfileViewProps {
  profile: Profile;
  posts: ({ id: string; content: string; created_at: string; author: string; photos: Photo[] | null; tagged: unknown[] | null; profiles?: { id: string; name: string; avatar: string } })[];
  friends: { id: string; name: string; avatar: string }[];
  photos: { photos: Photo[] | null }[];
  currentUserId: string | null;
  initialTab: string;
}

const tabs = [
  { key: "about",   label: "Info" },
  { key: "posts",   label: "Posteos" },
  { key: "friends", label: "Amigos" },
  { key: "photos",  label: "Fotos" },
];

export default function ProfileView({
  profile,
  posts: initialPosts,
  friends: initialFriends,
  photos: initialPhotos,
  currentUserId,
  initialTab,
}: ProfileViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") ?? initialTab;

  const [activeTab, setActiveTab] = useState(tab);
  const [editing, setEditing] = useState(false);
  const [about, setAbout] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [profileUrl, setProfileUrl] = useState("");

  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const isOwn = profile.id === currentUserId;

  const { data: isFriend = false } = useQuery({
    queryKey: ["is-friend", currentUserId, profile.id],
    queryFn: async (): Promise<boolean> => {
      if (!currentUserId) return false;
      const { data } = await supabase
        .from("friends")
        .select("id")
        .eq("user_id", currentUserId)
        .eq("friend_id", profile.id);
      return (data?.length ?? 0) > 0;
    },
    enabled: !!currentUserId && !isOwn,
  });

  const addFriend = useMutation({
    mutationFn: async () => {
      if (!currentUserId) return;
      await supabase.from("friends").insert({ user_id: currentUserId, friend_id: profile.id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["is-friend", currentUserId, profile.id] });
    },
  });

  const removeFriend = useMutation({
    mutationFn: async () => {
      if (!currentUserId) return;
      await supabase.from("friends").delete()
        .eq("user_id", currentUserId)
        .eq("friend_id", profile.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["is-friend", currentUserId, profile.id] });
    },
  });

  useEffect(() => { setActiveTab(tab); }, [tab]);

  useEffect(() => {
    if (profile.cover)  setCoverUrl(profile.cover);
    if (profile.avatar) setProfileUrl(profile.avatar);
  }, [profile]);

  function handleTabChange(newTab: string) {
    setActiveTab(newTab);
    router.push(`/profile/${profile.id}?tab=${newTab}`);
  }

  async function handleCoverUpload(event: React.ChangeEvent<HTMLInputElement>) {
    if (!currentUserId || !event.target.files?.[0]) return;
    const file = event.target.files[0];
    const fileName = `${currentUserId}/cover.${file.name.split(".").pop()}`;
    const { error } = await supabase.storage.from("covers").upload(fileName, file, {
      upsert: true,
      contentType: file.type || "image/jpeg",
    });
    if (error) return;
    const { data: urlData } = supabase.storage.from("covers").getPublicUrl(fileName);
    setCoverUrl(urlData.publicUrl);
    await supabase.from("profiles").update({ cover: urlData.publicUrl }).eq("id", currentUserId);
    queryClient.invalidateQueries({ queryKey: ["profile", currentUserId] });
  }

  async function handleProfileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    if (!currentUserId || !event.target.files?.[0]) return;
    const file = event.target.files[0];
    const fileName = `${currentUserId}/profile.${file.name.split(".").pop()}`;
    const { error } = await supabase.storage.from("avatars").upload(fileName, file, {
      upsert: true,
      contentType: file.type || "image/jpeg",
    });
    if (error) return;
    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(fileName);
    setProfileUrl(urlData.publicUrl);
    await supabase.from("profiles").update({ avatar: urlData.publicUrl }).eq("id", currentUserId);
    queryClient.invalidateQueries({ queryKey: ["profile", currentUserId] });
  }

  async function handleSaveAbout() {
    await supabase.from("profiles").update({ about }).eq("id", profile.id);
    queryClient.invalidateQueries({ queryKey: ["profile", profile.id] });
    setEditing(false);
  }

  return (
    <div className="glass-card overflow-hidden mb-5">
      {/* Cover */}
      <div
        className="relative h-44 md:h-56 bg-cover bg-center"
        style={{
          backgroundImage: coverUrl
            ? `url(${coverUrl})`
            : "linear-gradient(135deg, var(--aurora-4), var(--aurora-2))",
        }}
      >
        {/* Gradient overlay */}
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent 40%, var(--bg-surface) 100%)" }} />

        {isOwn && (
          <label
            htmlFor="cover"
            className="absolute top-3 right-3 cursor-pointer w-8 h-8 flex items-center justify-center rounded-lg bg-black/40 hover:bg-black/60 text-white transition-colors"
            title="Cambiar portada"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path d="M21.731 2.269a2.625 2.625 0 0 0-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 0 0 0-3.712ZM19.513 8.199l-3.712-3.712-8.4 8.4a5.25 5.25 0 0 0-1.32 2.214l-.8 2.685a.75.75 0 0 0 .933.933l2.685-.8a5.25 5.25 0 0 0 2.214-1.32l8.4-8.4Z" />
              <path d="M5.25 5.25a3 3 0 0 0-3 3v10.5a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3V13.5a.75.75 0 0 0-1.5 0v5.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5V8.25a1.5 1.5 0 0 1 1.5-1.5h5.25a.75.75 0 0 0 0-1.5H5.25Z" />
            </svg>
            <input type="file" id="cover" className="hidden" accept="image/*" onChange={handleCoverUpload} />
          </label>
        )}

        {/* Avatar — overlapping the cover bottom */}
        <div className="absolute -bottom-10 left-6">
          <div className="relative">
            <Avatar url={profileUrl || null} size="lg" ring />
            {isOwn && (
              <label
                htmlFor="avatar"
                className="absolute bottom-0 right-0 w-7 h-7 flex items-center justify-center rounded-full bg-[var(--accent)] cursor-pointer hover:bg-[var(--accent-hover)] transition-colors"
                title="Cambiar foto"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 text-white">
                  <path d="M21.731 2.269a2.625 2.625 0 0 0-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 0 0 0-3.712ZM19.513 8.199l-3.712-3.712-8.4 8.4a5.25 5.25 0 0 0-1.32 2.214l-.8 2.685a.75.75 0 0 0 .933.933l2.685-.8a5.25 5.25 0 0 0 2.214-1.32l8.4-8.4Z" />
                </svg>
                <input type="file" id="avatar" className="hidden" accept="image/*" onChange={handleProfileUpload} />
              </label>
            )}
          </div>
        </div>
      </div>

      {/* Profile info */}
      <div className="pt-14 px-6 pb-4 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-[color:var(--text-primary)]">{profile.name}</h1>
          {profile.about && (
            <p className="text-sm text-[color:var(--text-secondary)] mt-0.5">{profile.about}</p>
          )}
          <ArmySinceBadge
            armySince={profile.army_since}
            isOwn={isOwn}
            profileId={profile.id}
            onUpdate={() => queryClient.invalidateQueries({ queryKey: ["profile", profile.id] })}
          />
        </div>

        {!isFriend && !isOwn && (
          <button
            type="button"
            onClick={() => addFriend.mutate()}
            className="btn-accent text-sm py-2 px-4 flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path d="M6.25 6.375a4.125 4.125 0 1 1 8.25 0 4.125 4.125 0 0 1-8.25 0ZM3.25 19.125a7.125 7.125 0 0 1 14.25 0v.003l-.001.119a.75.75 0 0 1-.363.63 13.067 13.067 0 0 1-6.761 1.873c-2.472 0-4.786-.684-6.76-1.873a.75.75 0 0 1-.364-.63l-.001-.122ZM19.75 7.5a.75.75 0 0 1 .75.75v2.25h2.25a.75.75 0 0 1 0 1.5h-2.25v2.25a.75.75 0 0 1-1.5 0v-2.25h-2.25a.75.75 0 0 1 0-1.5h2.25V8.25a.75.75 0 0 1 .75-.75Z" />
            </svg>
            Agregar amigo
          </button>
        )}

        {isFriend && !isOwn && (
          <span className="text-sm text-[color:var(--text-muted)] flex items-center gap-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-[color:var(--accent)]">
              <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 0 1 .208 1.04l-9 13.5a.75.75 0 0 1-1.154.114l-6-6a.75.75 0 0 1 1.06-1.06l5.353 5.353 8.493-12.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
            </svg>
            Amigos
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-t border-white/5 px-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => handleTabChange(t.key)}
            className={`relative px-4 py-3 text-sm font-medium transition-colors duration-200 ${
              activeTab === t.key
                ? "text-[color:var(--text-primary)]"
                : "text-[color:var(--text-muted)] hover:text-[color:var(--text-secondary)]"
            }`}
          >
            {t.label}
            {activeTab === t.key && (
              <motion.div
                layoutId="profile-tab-indicator"
                className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full"
                style={{ background: "var(--accent)" }}
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="px-6 py-5">

        {/* About */}
        {activeTab === "about" && (
          <div>
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <h2 className="text-sm font-semibold text-[color:var(--text-secondary)] uppercase tracking-wider mb-3">Sobre mí</h2>
                {editing ? (
                  <input
                    type="text"
                    value={about}
                    onChange={(ev) => setAbout(ev.target.value)}
                    className="army-input w-full px-4 py-2.5 text-sm"
                    autoFocus
                  />
                ) : (
                  <p className="text-[color:var(--text-primary)] text-sm leading-relaxed">
                    {profile.about || <span className="text-[color:var(--text-muted)] italic">Sin descripción</span>}
                  </p>
                )}
              </div>

              {isOwn && (
                <div className="flex gap-2 mt-5 shrink-0">
                  {!editing ? (
                    <button
                      type="button"
                      onClick={() => { setEditing(true); setAbout(profile.about ?? ""); }}
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)] transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                        <path d="M21.731 2.269a2.625 2.625 0 0 0-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 0 0 0-3.712ZM19.513 8.199l-3.712-3.712-8.4 8.4a5.25 5.25 0 0 0-1.32 2.214l-.8 2.685a.75.75 0 0 0 .933.933l2.685-.8a5.25 5.25 0 0 0 2.214-1.32l8.4-8.4Z" />
                      </svg>
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={handleSaveAbout}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-[color:var(--accent)]/20 text-[color:var(--accent)] hover:bg-[color:var(--accent)]/30 transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                          <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 0 1 .208 1.04l-9 13.5a.75.75 0 0 1-1.154.114l-6-6a.75.75 0 0 1 1.06-1.06l5.353 5.353 8.493-12.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditing(false)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)] transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                          <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Posts */}
        {activeTab === "posts" && (
          <div>
            {initialPosts.length === 0 ? (
              <p className="text-[color:var(--text-muted)] text-sm text-center py-8">Sin publicaciones aún</p>
            ) : (
              initialPosts.map((post) => {
                const authorProfile = post.profiles ?? { id: post.author, name: "Unknown", avatar: "" };
                const tagged = post.tagged as TaggedFriend[] | null;
                return (
                  <PostsCard
                    key={post.id}
                    id={post.id}
                    content={post.content}
                    created_at={post.created_at}
                    photos={post.photos}
                    tagged={tagged}
                    profiles={authorProfile}
                  />
                );
              })
            )}
          </div>
        )}

        {/* Friends */}
        {activeTab === "friends" && (
          <div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {initialFriends.length === 0 ? (
                <p className="text-[color:var(--text-muted)] text-sm col-span-full text-center py-8">Sin amigos aún</p>
              ) : (
                initialFriends.map((friend) => (
                  <div key={friend.id} className="glass-card p-4 flex flex-col items-center gap-3 hover:border-[color:var(--accent)]/30 transition-colors">
                    {isOwn && (
                      <button
                        type="button"
                        onClick={() => removeFriend.mutate()}
                        className="self-end w-6 h-6 flex items-center justify-center rounded text-[color:var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors -mt-1 -mr-1"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                          <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                        </svg>
                      </button>
                    )}
                    <Link href={`/profile/${friend.id}`} className="flex flex-col items-center gap-2 hover:opacity-80 transition-opacity">
                      <Avatar url={friend.avatar || null} size="md" ring />
                      <p className="text-sm text-[color:var(--text-primary)] font-medium text-center">{friend.name}</p>
                    </Link>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Photos */}
        {activeTab === "photos" && (
          <div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {initialPhotos.flatMap((el, i) =>
                (el.photos ?? []).map((img, j) => (
                  <div
                    key={`${i}-${j}`}
                    className="rounded-xl overflow-hidden aspect-square hover:opacity-80 cursor-pointer transition-opacity"
                  >
                    <img src={img.url} alt="" className="w-full h-full object-cover" />
                  </div>
                ))
              ).length === 0 ? (
                <p className="text-[color:var(--text-muted)] text-sm col-span-full text-center py-8">Sin fotos aún</p>
              ) : (
                initialPhotos.flatMap((el, i) =>
                  (el.photos ?? []).map((img, j) => (
                    <div
                      key={`${i}-${j}`}
                      className="rounded-xl overflow-hidden aspect-square hover:opacity-80 cursor-pointer transition-opacity"
                    >
                      <img src={img.url} alt="" className="w-full h-full object-cover" />
                    </div>
                  ))
                )
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
