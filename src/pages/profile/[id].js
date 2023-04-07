import Avatar from "@/components/Avatar";
import Card from "@/components/Card";
import Layout from "@/components/Layout";
import PostsCard from "@/components/PostsCard";
import { UserContext } from "@/contexts/UserContext";
import {
  fFriends,
  fPhotos,
  fperfil,
  fuserPosts,
  tEditarAbout,
} from "@/utils/fperfil";
import { useSession, useSupabaseClient } from "@supabase/auth-helpers-react";
import Head from "next/head";
import Link from "next/link";

import { useRouter } from "next/router";
import React, { useContext, useEffect, useState } from "react";

export default function Profile() {
  const router = useRouter();
  const session = useSession();
  const supabase = useSupabaseClient();
  const [editable, setEditable] = useState(false);
  const [editing, setEditing] = useState(false);
  const [about, setAbout] = useState("");
  const [photos, setPhotos] = useState([]);
  const [user, setUser] = useState(null); // contiene el usuario logueado
  const [coverUrl, setCoverUrl] = useState("");
  const [profileUrl, setProfileUrl] = useState("");
  const [activeTab, setActiveTab] = useState("about");
  const { profile, friends, setFriends, setProfile, posts, setPosts } =
    useContext(UserContext);
  const [userFriends, setUserFriends] = useState([]);
  const [isFriend, setIsFriend] = useState(false);

  useEffect(() => {
    setUser(session?.user.id);
    const hash = window.location.hash.substr(1);
    if (hash === "friends") setActiveTab("friends");
    fperfil(router.query.id, supabase, setProfile);
    checkFriendship();
    if (profile?.id === user) {
      //si el perfil que se llamo es el del usuario logueado, se puede editar todo.
      console.log(user);
      setEditable(true);
    }
  }, [router]);

  useEffect(() => {
    fFriends(supabase, profile?.id, setFriends);
    profile?.cover
      ? setCoverUrl(profile?.cover)
      : setCoverUrl("/assets/images/cover-bg.jpg");
    setProfileUrl(profile?.avatar);
    fuserPosts(supabase, profile?.id, setPosts);
    fPhotos(supabase, profile?.id, setPhotos);
    checkFriendship();
  }, [profile, isFriend, editing]);

  function handleRemoveFriend(e, friend) {
    // e.preventDefault();
    supabase
      .from("friends")
      .delete()
      .eq("friend_id", friend.id)
      .then(() => alert("Amigo eliminado con exito"));
    setIsFriend(false);
  }

  function checkFriendship() {
    fFriends(supabase, session?.user?.id, setUserFriends);
    userFriends.map((friend) => {
      if (friend.id === profile?.id) {
        setIsFriend(true);
      }
    });
  }

  async function handleAddFriend(id, userId) {
    await supabase
      .from("friends")
      .insert({ user_id: userId, friend_id: id })
      .then(() => console.log("solicitud enviada"));
    setIsFriend(true);
  }
  // console.log(response);
  async function handleCoverUpload(event) {
    const file = event.target.files[0];
    const fileExt = file.name.split(".").pop();
    const fileName = `${user.id}/cover.${fileExt}`;
    const { data, error } = await supabase.storage
      .from("covers")
      .upload(fileName, file);
    if (error) console.log("Error uploading cover: ", error.message);
    if (data) {
      const { publicURL } = supabase.storage
        .from("covers")
        .getPublicUrl(fileName);
      setCoverUrl(publicURL);
      await supabase
        .from("profiles")
        .update({ cover: publicURL })
        .eq("id", user.id);
    }
  }
  async function handleProfileUpload(event) {
    const file = event.target.files[0];
    const fileExt = file.name.split(".").pop();
    const fileName = `${user.id}/profile.${fileExt}`;
    const { data, error } = await supabase.storage
      .from("avatars")
      .upload(fileName, file);
    if (error) console.log("Error uploading profile: ", error.message);
    if (data) {
      const { publicURL } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName);
      // console.log(data);
      setProfileUrl(publicURL);
      await supabase
        .from("profiles")
        .update({ avatar: publicURL })
        .eq("id", user?.data?.user.id);
    }
  }

  return (
    <Layout>
      <Head>
        <title>Perfil de {profile?.name}</title>
      </Head>
      <div className="bg-gray-100 rounded-md">
        <div
          className="bg-cover bg-center h-48"
          style={{ backgroundImage: `url(${coverUrl})` }}
        >
          {editable && (
            <div className="flex flex-row-reverse">
              <label
                htmlFor="profile"
                className="bg-gray-400 bg-opacity-50 px-2 py-1 rounded-full  text-white cursor-pointer hover:scale-105 hover:transition-all hover:bg-opacity-80 hover:bg-gray-700 hover:duration-500"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-6 h-6"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
                  />
                </svg>
              </label>
              <input
                type="file"
                id="profile"
                className="hidden"
                accept="image/*"
                onChange={handleCoverUpload}
              />
            </div>
          )}
          <div className=" h-full flex justify-start items-end">
            <div className="w-28 h-28 relative overflow-visible rounded-full">
              <img
                src={profileUrl}
                alt="Profile"
                className="w-full h-full rounded-full object-cover"
              />
              {editable && (
                <div className="absolute inset-1  flex justify-end items-end">
                  <label
                    htmlFor="profile"
                    className="bg-gray-400 bg-opacity-50 px-2 py-1 rounded-full  text-white cursor-pointer  hover:scale-105 hover:transition-all hover:bg-opacity-80 hover:bg-gray-700 hover:duration-500"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="w-6 h-6"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
                      />
                    </svg>
                  </label>
                  <input
                    type="file"
                    id="profile"
                    className="hidden"
                    accept="image/*"
                    onChange={handleProfileUpload}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="container mx-auto mt-6 p-7">
          <ul className="flex border-b">
            <li
              className={`mr-6 py-2 cursor-pointer ${
                activeTab === "about" ? "border-b-2 border-blue-500" : ""
              }`}
              onClick={() => setActiveTab("about")}
            >
              Info
            </li>
            <li
              className={`mr-6 py-2 cursor-pointer ${
                activeTab === "posts" ? "border-b-2 border-blue-500" : ""
              }`}
              onClick={() => setActiveTab("posts")}
            >
              Posts
            </li>
            <li
              className={`mr-6 py-2 cursor-pointer ${
                activeTab === "friends" ? "border-b-2 border-blue-500" : ""
              }`}
              onClick={() => setActiveTab("friends")}
            >
              Amigos
            </li>
            <li
              className={`mr-6 py-2 cursor-pointer ${
                activeTab === "photos" ? "border-b-2 border-blue-500" : ""
              }`}
              onClick={() => setActiveTab("photos")}
            >
              Fotos
            </li>
          </ul>
          {activeTab === "about" && (
            <div className="relative pt-5">
              <h2 className="text-2xl font-semibold mb-4">Información</h2>
              {editing ? (
                <input
                  type="text"
                  value={about}
                  onChange={(ev) => setAbout(ev.target.value)}
                  className="rounded-md inline border px-3 w-full"
                />
              ) : (
                <p className="text-gray-600 inline mx-3 leading-6 pb-2">
                  {profile?.about}
                </p>
              )}
              {profile?.id === user && !editing && (
                <button
                  className="py-0"
                  onClick={() =>
                    tEditarAbout(
                      supabase,
                      profile,
                      setProfile,
                      editing,
                      setEditing,
                      about,
                      setAbout
                    )
                  }
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="w-6 h-6"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
                    />
                  </svg>
                </button>
              )}

              {profile?.id === router.query.id && editing && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      tEditarAbout(
                        supabase,
                        profile,
                        setProfile,
                        editing,
                        setEditing,
                        about,
                        setAbout
                      )
                    }
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="w-6 h-6"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4.5 12.75l6 6 9-13.5"
                      />
                    </svg>
                  </button>
                  <button onClick={() => setEditing(false)}>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="w-6 h-6"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                      />
                    </svg>
                  </button>
                </div>
              )}
              {!isFriend && (
                <button
                  className="absolute flex gap-2 items-center px-4 py-2 bg-purple-400 text-sm rounded-md hover:bg-purple-200 top-4 md:top-9 right-0"
                  onClick={() => handleAddFriend(profile?.id, user)}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="w-6 h-6"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z"
                    />
                  </svg>
                  <span className="hidden md:inline">Solicitar amistad</span>
                </button>
              )}
            </div>
          )}
          {activeTab === "posts" && (
            <div className="pt-5">
              <h2 className="text-2xl font-semibold mb-4">Posts</h2>
              {posts?.map((post) => (
                <PostsCard key={post.id} {...post} />
              ))}
            </div>
          )}
          {activeTab === "friends" && (
            <div className="pt-5">
              <h2 className="text-2xl font-semibold mb-4">Amigos</h2>
              <div className="flex flex-wrap gap-2">
                {friends &&
                  friends.map((friend) => (
                    <Card key={friend.id} className=" hover:scale-110">
                      <div className="relative flex flex-col items-center hover:scale-110 hover:transition-all hover:duration-700">
                        <button
                          onClick={(e) => handleRemoveFriend(e, friend)}
                          className="absolute cursor-pointer top-0 right-0"
                        >
                          X
                        </button>
                        <Link
                          className="cursor-pointer hover:opacity-70"
                          href={`/profile/${friend.id}`}
                        >
                          <Avatar url={friend.avatar} size={"md"} />
                        </Link>
                        <p>{friend.name}</p>
                      </div>
                    </Card>
                  ))}
              </div>
            </div>
          )}
          {activeTab === "photos" && (
            <div className="pt-5">
              <h2 className="text-2xl font-semibold mb-4">Fotos</h2>
              <div className="grid md:grid-cols-2 gap-4">
                {photos.map(
                  (elemento) =>
                    elemento.photos?.length > 1 &&
                    elemento.photos.map((imagen) => (
                      <div
                        key={imagen.index}
                        className="rounded-md overflow-hidden flex items-center h-32 hover:opacity-50 cursor-pointer hover:shadow-md hover:translate-x-1 transition-all"
                      >
                        <img src={imagen} alt="1" />
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
