"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Avatar from "@/components/Avatar";
import Card from "@/components/Card";
import Layout from "@/components/Layout";
import PostsCard from "@/components/PostsCard";
import { useAuthStore } from "@/store/useAuthStore";
import { useProfile } from "@/hooks/useProfile";
import { useFriends, useAddFriend, useRemoveFriend } from "@/hooks/useFriends";
import { useUserPosts } from "@/hooks/usePosts";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import type { Profile, Photo } from "@/types";

function usePhotos(userId: string | null) {
  return useQuery({
    queryKey: ["photos", userId],
    queryFn: async (): Promise<{ photos: Photo[] }[]> => {
      const { data } = await supabase.from("posts").select("photos").eq("author", userId!);
      return (data ?? []).filter((e: { photos: Photo[] | null }) => e.photos && e.photos.length > 0);
    },
    enabled: !!userId,
  });
}

function useIsFriend(userId: string | null, profileId: string | undefined) {
  return useQuery({
    queryKey: ["is-friend", userId, profileId],
    queryFn: async (): Promise<boolean> => {
      const { data } = await supabase
        .from("friends")
        .select("id")
        .eq("user_id", userId!)
        .eq("friend_id", profileId!);
      return (data?.length ?? 0) > 0;
    },
    enabled: !!userId && !!profileId,
  });
}

const tabs = [
  { key: "about", label: "Info" },
  { key: "posts", label: "Posteos" },
  { key: "friends", label: "Amigos" },
  { key: "photos", label: "Fotos" },
];

export default function ProfilePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = params.id as string;
  const tab = searchParams.get("tab") ?? "about";

  const [activeTab, setActiveTab] = useState(tab);
  const [editing, setEditing] = useState(false);
  const [about, setAbout] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [profileUrl, setProfileUrl] = useState("");

  const { user } = useAuthStore();
  const { data: profile } = useProfile(id);
  const { data: friends = [] } = useFriends(user);
  const { data: posts = [] } = useUserPosts(id);
  const { data: photos = [] } = usePhotos(id);
  const { data: isFriend = false } = useIsFriend(user, id);

  const addFriend = useAddFriend();
  const removeFriend = useRemoveFriend();
  const queryClient = useQueryClient();

  const isOwn = profile?.id === user;

  useEffect(() => {
    setActiveTab(tab);
  }, [tab]);

  useEffect(() => {
    if (profile?.cover) setCoverUrl(profile.cover);
    if (profile?.avatar) setProfileUrl(profile.avatar);
  }, [profile]);

  function handleTabChange(newTab: string) {
    setActiveTab(newTab);
    router.push(`/profile/${id}?tab=${newTab}`);
  }

  async function handleCoverUpload(event: React.ChangeEvent<HTMLInputElement>) {
    if (!user || !event.target.files?.[0]) return;
    const file = event.target.files[0];
    const fileName = `${user}/cover.${file.name.split(".").pop()}`;
    const { error } = await supabase.storage.from("covers").upload(fileName, file);
    if (error) return;
    const { data: urlData } = supabase.storage.from("covers").getPublicUrl(fileName);
    setCoverUrl(urlData.publicUrl);
    await supabase.from("profiles").update({ cover: urlData.publicUrl }).eq("id", user);
    queryClient.invalidateQueries({ queryKey: ["profile", user] });
  }

  async function handleProfileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    if (!user || !event.target.files?.[0]) return;
    const file = event.target.files[0];
    const fileName = `${user}/profile.${file.name.split(".").pop()}`;
    const { error } = await supabase.storage.from("avatars").upload(fileName, file);
    if (error) return;
    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(fileName);
    setProfileUrl(urlData.publicUrl);
    await supabase.from("profiles").update({ avatar: urlData.publicUrl }).eq("id", user);
    queryClient.invalidateQueries({ queryKey: ["profile", user] });
  }

  async function handleSaveAbout() {
    if (!profile) return;
    await supabase.from("profiles").update({ about }).eq("id", profile.id);
    queryClient.invalidateQueries({ queryKey: ["profile", id] });
    setEditing(false);
  }

  return (
    <Layout>
      <div className="bg-gray-100 rounded-md">
        {/* Cover */}
        <div className="bg-cover bg-center h-48" style={{ backgroundImage: `url(${coverUrl})` }}>
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
                <Link href={`/profile/${id}?tab=${t.key}`}>{t.label}</Link>
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
                <p className="text-gray-600 inline mx-3 leading-6 pb-2">{profile?.about}</p>
              )}
              {isOwn && (
                <div className="flex items-center gap-2 mt-2">
                  {!editing ? (
                    <button type="button" onClick={() => { setEditing(true); setAbout(profile?.about ?? ""); }}>
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
                  onClick={() => user && addFriend.mutate({ userId: user, friendId: id })}>
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
              {posts.map((post) => <PostsCard key={post.id} {...post} />)}
            </div>
          )}

          {/* Friends */}
          {activeTab === "friends" && (
            <div className="pt-5">
              <h2 className="text-2xl font-semibold mb-4">Amigos</h2>
              <div className="flex flex-wrap gap-2">
                {friends.map((friend) => (
                  <Card key={friend.id}>
                    <div className="relative flex flex-col items-center hover:scale-110 hover:transition-all hover:duration-700">
                      <button type="button" onClick={() => user && removeFriend.mutate({ userId: user, friendId: friend.id })} className="absolute cursor-pointer top-0 right-0">
                        X
                      </button>
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
                {photos.map((elemento, i) =>
                  elemento.photos?.length > 1 &&
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
    </Layout>
  );
}
