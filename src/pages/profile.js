import Avatar from "@/components/Avatar";
import Card from "@/components/Card";
import Layout from "@/components/Layout";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useSession, useSupabaseClient } from "@supabase/auth-helpers-react";
import Cover from "@/components/Cover";
import ProfileTabs from "@/components/ProfileTabs";
import ProfileContent from "@/components/ProfileContent";
import { UserContext } from "@/contexts/UserContext";

function ProfilePage() {
  const [name, setName] = useState("");
  const [place, setPlace] = useState("");
  const [profile, setProfile] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [isMyfriend, setisMyFriend] = useState(false);
  const [myProfile, setMyProfile] = useState(null);
  const router = useRouter();
  const session = useSession();
  const userId = router.query.id;
  const isMyUser = userId === session?.user?.id;
  const tab = router?.query?.tab?.[0] || "posts";

  const supabase = useSupabaseClient();

  useEffect(() => {
    if (!userId) {
      return;
    }

    fetchUser();
    isFriend();
  }, [profile, userId, isFriend]);

  function fetchUser() {
    supabase
      .from("profiles")
      .select()
      .eq("id", userId)
      .then((result) => {
        if (result.error) {
          throw result.error;
        }
        if (result.data) {
          setProfile(result.data[0]);
        }
      });
  }
  function isFriend() {
    supabase
      .from("friends")
      .select()
      .eq("user_id", session?.user.id)
      .then((result) => {
        const oo = result?.data?.filter(
          (elemento) => elemento.user_id === session.user.id
        );
        oo?.map((friend) => {
          if (userId === friend.friend_id) {
            setisMyFriend(true);
          } else {
            setisMyFriend(false);
          }
        });
      });
  }
  function toggleFriend() {
    supabase
      .from("profiles")
      .select()
      .eq("id", session.user.id)
      .then((result) => {
        setMyProfile(result.data[0]);
      });
    if (!isMyfriend) {
      supabase
        .from("friends")
        .insert({
          user_id: myProfile?.id,
          friend_id: profile?.id,
        })
        .then(() =>
          console.log(
            profile?.id + " y " + myProfile?.id + " se han hecho amigos"
          )
        );
    } else {
      supabase
        .from("friends")
        .delete()
        .eq("user_id", myProfile?.id)
        .eq("friend_id", profile?.id)
        .then(() => isFriend());
      return;
    }
  }
  function saveProfile() {
    supabase
      .from("profiles")
      .update({
        name,
        place,
      })
      .eq("id", session.user.id)
      .then((result) => {
        if (!result.error) {
          setProfile((prev) => ({ ...prev, name, place }));
        }
        setEditMode(false);
      });
  }

  if (!profile?.cover) {
    setProfile((prev) => ({
      ...prev,
      cover:
        "https://images.pexels.com/photos/1029604/pexels-photo-1029604.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1",
    }));
  }

  return (
    <Layout>
      <UserContext.Provider value={{}}>
        <Card noPadding={true}>
          <div className="relative">
            <Cover
              url={profile?.cover}
              editable={isMyUser}
              onChange={fetchUser}
            />
            <div className="absolute top-[70px] left-3">
              {profile && (
                <Avatar
                  url={profile?.avatar}
                  size={"lg"}
                  editable={isMyUser}
                  onChange={fetchUser}
                />
              )}
            </div>
            <div className="py-1 pl-12 pr-3 pb-8">
              .
              <div className="flex justify-between items-center">
                <div className="ml-28 flex flex-col gap-2">
                  <h1 className="text-2xl font-bold">
                    {!editMode && profile?.name}
                    {editMode && (
                      <input
                        type="text"
                        value={name}
                        onChange={(ev) => setName(ev.target.value)}
                        placeholder="Tu nombre"
                        className="rounded-md border px-3"
                      />
                    )}
                  </h1>
                  {!editMode && (
                    <div className="text-sm text-gray-500 leading-4 ">
                      {profile?.place || "Desconocido"}
                    </div>
                  )}
                  {editMode && (
                    <input
                      type="text"
                      value={place}
                      onChange={(ev) => setPlace(ev.target.value)}
                      placeholder="Tu lugar"
                      className="rounded-md border px-3"
                    />
                  )}
                </div>
                {!isMyUser && !isMyfriend && (
                  <button
                    onClick={toggleFriend}
                    id="addFriend"
                    className="p-2 bg-purple-600 flex mr-10 rounded-md shadow-lg shadow-purple-500 hover:scale-105"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="white"
                      className="w-6 h-6"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z"
                      />
                    </svg>
                  </button>
                )}
                {!isMyUser && isMyfriend && (
                  <button
                    onClick={toggleFriend}
                    id="removeFriend"
                    className="p-2 bg-purple-600 flex mr-10 rounded-md shadow-lg shadow-purple-500 hover:scale-105"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="red"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="white"
                      className="w-6 h-6"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M22 10.5h-6m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z"
                      />
                    </svg>
                  </button>
                )}
                {isMyUser && !editMode && (
                  <div className="hover:backdrop-blur-sm hover:shadow-sm">
                    <button
                      onClick={() => {
                        setEditMode(true);
                        setName(profile.name);
                        setPlace(profile.place);
                      }}
                      className="text-sm px-2 py-1 rounded-md bg-transparent border border-purple-600  cursor-pointer hover:scale-110 hover:transition-all flex gap-1 items-center"
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
                      Editar Perfil
                    </button>
                  </div>
                )}
                {isMyUser && editMode && (
                  <div className="hover:backdrop-blur-sm hover:shadow-sm">
                    <div>
                      <button
                        onClick={() => saveProfile()}
                        className="text-sm w-40 px-2 py-1 rounded-md bg-purple-200 border border-purple-600  cursor-pointer hover:scale-110 flex gap-1 items-center"
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
                            d="M10.125 2.25h-4.5c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125v-9M10.125 2.25h.375a9 9 0 019 9v.375M10.125 2.25A3.375 3.375 0 0113.5 5.625v1.5c0 .621.504 1.125 1.125 1.125h1.5a3.375 3.375 0 013.375 3.375M9 15l2.25 2.25L15 12"
                          />
                        </svg>
                        Guardar Cambios
                      </button>
                    </div>
                    <button
                      onClick={() => setEditMode(false)}
                      className="mt-1 text-sm w-40 px-2 py-1 rounded-md bg-purple-400 border border-purple-600  cursor-pointer hover:scale-110 flex gap-1 items-center"
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
                          d="M10.125 2.25h-4.5c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125v-9M10.125 2.25h.375a9 9 0 019 9v.375M10.125 2.25A3.375 3.375 0 0113.5 5.625v1.5c0 .621.504 1.125 1.125 1.125h1.5a3.375 3.375 0 013.375 3.375M9 15l2.25 2.25L15 12"
                        />
                      </svg>
                      Cancelar Cambios
                    </button>
                  </div>
                )}
              </div>
            </div>

            <ProfileTabs active={tab} userId={profile?.id} />
          </div>
        </Card>
        <ProfileContent active={tab} userId={userId} />
      </UserContext.Provider>
    </Layout>
  );
}

export default ProfilePage;
