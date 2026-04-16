"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Avatar from "@/components/Avatar";
import Card from "@/components/Card";
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

type Post = {
  id: string;
  content: string;
  created_at: string;
  author: string;
  photos: Photo[] | null;
  tagged: unknown[] | null;
};

const tabs = [
  { key: "about", label: "Info" },
  { key: "posts", label: "Posteos" },
  { key: "friends", label: "Amigos" },
  { key: "photos", label: "Fotos" },
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
      await supabase.from("friends").delete().eq("user_id", currentUserId).eq("friend_id", profile.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["is-friend", currentUserId, profile.id] });
    },
  });

  useEffect(() => {
    setActiveTab(tab);
  }, [tab]);

  useEffect(() => {
    if (profile.cover) setCoverUrl(profile.cover);
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
    const { error } = await supabase.storage.from("covers").upload(fileName, file);
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
    const { error } = await supabase.storage.from("avatars").upload(fileName, file);
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
    <div className="bg-gray-100 rounded-md">
      {/* Cover */}
      <div className="bg-cover bg-center h-48" style={{ backgroundImage: coverUrl ? `url(${coverUrl})` : undefined }}>
        {isOwn && (
          <div className="flex flex-row-reverse">
            <label htmlFor="cover" className="bg-gray-400 bg-opacity-50 px-2 py-1 rounded-full text-white cursor-pointer hover:bg-gray-700 hover:bg-opacity-80 transition-all">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
              </svg>
            </label>
            <input type="file" id="cover" className="hidden" accept="image/*" onChange={handleCoverUpload} />
          </div>
        )}
        <div className="h-full flex justify-start items-end">
          <div className="w-28 h-28 relative overflow-visible rounded-full">
            <img src={profileUrl} alt="Profile" className="w-full h-full rounded-full object-cover" />
            {isOwn && (
              <div className="absolute inset-1 flex justify-end items-end">
                <label htmlFor="avatar" className="bg-gray-400 bg-opacity-50 px-2 py-1 rounded-full text-white cursor-pointer hover:bg-gray-700 hover:bg-opacity-80 transition-all">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                  </svg>
                </label>
                <input type="file" id="avatar" className="hidden" accept="image/*" onChange={handleProfileUpload} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="container mx-auto mt-6 p-7">
        <ul className="flex border-b">
          {tabs.map((t) => (
            <li key={t.key} className={`mr-6 py-2 cursor-pointer ${activeTab === t.key ? "border-b-2 border-blue-500" : ""}`} onClick={() => handleTabChange(t.key)}>
              <Link href={`/profile/${profile.id}?tab=${t.key}`}>{t.label}</Link>
            </li>
          ))}
        </ul>

        {/* About */}
        {activeTab === "about" && (
          <div className="relative pt-5">
            <h2 className="text-2xl font-semibold mb-4">Información</h2>
            {editing ? (
              <input type="text" value={about} onChange={(ev) => setAbout(ev.target.value)} className="rounded-md inline border px-3 w-full" />
            ) : (
              <p className="text-gray-600 inline mx-3 leading-6 pb-2">{profile.about}</p>
            )}
            {isOwn && (
              <div className="flex items-center gap-2 mt-2">
                {!editing ? (
                  <button type="button" onClick={() => { setEditing(true); setAbout(profile.about ?? ""); }}>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                    </svg>
                  </button>
                ) : (
                  <>
                    <button type="button" onClick={handleSaveAbout}>
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    </button>
                    <button type="button" onClick={() => setEditing(false)}>
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                    </button>
                  </>
                )}
              </div>
            )}
            {!isFriend && !isOwn && (
              <button type="button" className="absolute flex gap-2 items-center px-4 py-2 bg-purple-400 text-sm rounded-md hover:bg-purple-200 top-4 md:top-9 right-0"
                onClick={() => addFriend.mutate()}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
                </svg>
                <span className="hidden md:inline">Solicitar amistad</span>
              </button>
            )}
          </div>
        )}

        {/* Posts */}
        {activeTab === "posts" && (
          <div className="pt-5">
            <h2 className="text-2xl font-semibold mb-4">Posts</h2>
            {initialPosts.map((post) => {
              const authorProfile = post.profiles ?? { id: post.author, name: "Unknown", avatar: "" };
              const tagged = post.tagged as TaggedFriend[] | null;
              return <PostsCard key={post.id} id={post.id} content={post.content} created_at={post.created_at} photos={post.photos} tagged={tagged} profiles={authorProfile} />;
            })}
          </div>
        )}

        {/* Friends */}
        {activeTab === "friends" && (
          <div className="pt-5">
            <h2 className="text-2xl font-semibold mb-4">Amigos</h2>
            <div className="flex flex-wrap gap-2">
              {initialFriends.map((friend) => (
                <Card key={friend.id}>
                  <div className="relative flex flex-col items-center hover:scale-110 hover:transition-all hover:duration-700">
                    {isOwn && (
                      <button type="button" onClick={() => removeFriend.mutate()} className="absolute cursor-pointer top-0 right-0">
                        X
                      </button>
                    )}
                    <Link className="cursor-pointer hover:opacity-70" href={`/profile/${friend.id}`}>
                      <Avatar url={friend.avatar} size="md" />
                    </Link>
                    <p>{friend.name}</p>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Photos */}
        {activeTab === "photos" && (
          <div className="pt-5">
            <h2 className="text-2xl font-semibold mb-4">Fotos</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {initialPhotos.map((elemento, i) =>
                elemento.photos && elemento.photos.length > 0 &&
                elemento.photos.map((imagen, j) => (
                  <div key={`${i}-${j}`} className="rounded-md overflow-hidden flex items-center h-32 hover:opacity-50 cursor-pointer hover:shadow-md transition-all">
                    <img src={imagen.url} alt="" />
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}