import React, { useEffect, useState } from "react";
import Card from "./Card";
import FriendInfo from "./FriendInfo";
import PostCard from "./PostCard";
import { useSupabaseClient, useSession } from "@supabase/auth-helpers-react";

function ProfileContent({ active, userId }) {
  const [posts, setPosts] = useState([]);
  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState(null);
  const [about, setAbout] = useState("");
  const [friends, setFriends] = useState([]);
  const supabase = useSupabaseClient();
  const session = useSession();

  useEffect(() => {
    if (!userId) {
      return;
    }
    if (active === "posts") {
      loadPosts().then(() => {});
    }
    fetchProfile();
  }, [userId]);

  useEffect(() => {
    if (active === "friends") {
      fetchFriends()?.then(() => {
        console.log(friends);
      });
    }
  }, []);

  async function fetchProfile() {
    const preProfile = await userProfile(userId);
    setProfile(preProfile);
  }
  async function userPosts(userId) {
    const { data } = await supabase
      .from("posts")
      .select("id, content, created_at, author, photos")
      .is("parent", null)
      .eq("author", userId);
    return data;
  }
  async function userProfile(userId) {
    const { data } = await supabase.from("profiles").select().eq("id", userId);
    return data?.[0];
  }

  async function loadPosts() {
    const posts = await userPosts(userId);
    const profile = await userProfile(userId);
    setPosts(posts);
    setProfile(profile);
  }

  function tEditarAbout() {
    if (!editing) {
      setEditing(true);
      setAbout(profile.about);
    } else {
      setEditing(false);
      supabase
        .from("profiles")
        .update({
          about,
        })
        .eq("id", profile.id)
        .then(() => {
          fetchProfile(profile.id);
        });
    }
  }
  function fetchFriends() {
    console.log("fetching friends");

    supabase
      .from("friends")
      .select()
      .eq("user_id", profile?.id)
      .then((response) => {
        console.log(response.error);
        setFriends([]);
        const friendProfile = [];
        response?.data?.map(async (friend) => {
          const temp = await userProfile(friend.friend_id);
          friendProfile.push(temp);
          setFriends(friendProfile);
          console.log("friend added to array" + friendProfile);
        });
      });
    // .then(() => console.log(friends));
  }

  return (
    <div>
      {active === "posts" && (
        <div>
          {posts?.length > 0 &&
            posts.map((post) => (
              <PostCard key={post.created_at} {...post} profiles={profile} />
            ))}
        </div>
      )}
      {active === "about" && (
        <Card>
          <div className="flex gap-6">
            <h2 className="text-3xl font-bold py-5">Acerca de mi</h2>
            {userId === session.user.id && !editing && (
              <button onClick={tEditarAbout}>
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
            {userId === session.user.id && editing && (
              <div className="flex items-center gap-2">
                <button onClick={tEditarAbout}>
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
                <button>
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
          </div>
          {editing ? (
            <input
              type="text"
              value={about}
              onChange={(ev) => setAbout(ev.target.value)}
              className="rounded-md border px-3 w-full"
            />
          ) : (
            <p className="text-gray-600 leading-6 pb-2">{profile?.about}</p>
          )}
        </Card>
      )}
      {active === "friends" && (
        <Card>
          <h2 className="text-3xl font-bold py-5">Amigos</h2>
          <div className="grid md:grid-cols-2">
            {/* mapear profile.friends */}
            {friends.length > 0 &&
              friends.map((friend) => (
                <FriendInfo key={friend.id} friend={friend} />
              ))}
            {friends.length === 0 && (
              <p>Sin amigos. Agrega algunos a tu lista desde sus perfiles.</p>
            )}
          </div>
        </Card>
      )}
      {active === "photos" && (
        <Card>
          <h2 className="text-3xl font-bold py-5">Fotos</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-md overflow-hidden flex items-center h-32 hover:opacity-50 cursor-pointer hover:shadow-md hover:translate-x-1 transition-all">
              <img
                src="https://images.unsplash.com/photo-1603565816030-6b389eeb23cb?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=870&q=80"
                alt="1"
              />
            </div>
            <div className="rounded-md overflow-hidden flex items-center h-32 hover:opacity-50 cursor-pointer hover:shadow-md hover:translate-x-1 transition-all">
              <img
                src="https://images.unsplash.com/photo-1603565816030-6b389eeb23cb?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=870&q=80"
                alt="1"
              />
            </div>
            <div className="rounded-md overflow-hidden flex items-center h-32 hover:opacity-50 cursor-pointer hover:shadow-md hover:translate-x-1 transition-all">
              <img
                src="https://images.unsplash.com/photo-1603565816030-6b389eeb23cb?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=870&q=80"
                alt="1"
              />
            </div>
            <div className="rounded-md overflow-hidden flex items-center h-32 hover:opacity-50 cursor-pointer hover:shadow-md hover:translate-x-1 transition-all">
              <img
                src="https://images.unsplash.com/photo-1603565816030-6b389eeb23cb?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=870&q=80"
                alt="1"
              />
            </div>
            <div className="rounded-md overflow-hidden flex items-center h-32 hover:opacity-50 cursor-pointer hover:shadow-md hover:translate-x-1 transition-all">
              <img
                src="https://images.unsplash.com/photo-1603565816030-6b389eeb23cb?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=870&q=80"
                alt="1"
              />
            </div>
            <div className="rounded-md overflow-hidden flex items-center h-32 hover:opacity-50 cursor-pointer hover:shadow-md hover:translate-x-1 transition-all">
              <img
                src="https://images.unsplash.com/photo-1603565816030-6b389eeb23cb?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=870&q=80"
                alt="1"
              />
            </div>
            <div className="rounded-md overflow-hidden flex items-center h-32 hover:opacity-50 cursor-pointer hover:shadow-md hover:translate-x-1 transition-all">
              <img
                src="https://images.unsplash.com/photo-1603565816030-6b389eeb23cb?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=870&q=80"
                alt="1"
              />
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

export default ProfileContent;
