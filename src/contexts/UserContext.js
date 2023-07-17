import { fFriends, fperfil } from "@/utils/fetching";
import { useSession, useSupabaseClient } from "@supabase/auth-helpers-react";
import { createContext, useEffect, useState } from "react";

export const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [friends, setFriends] = useState([]);
  const [posts, setPosts] = useState([]);
  const [savedPosts, setSavedPosts] = useState([]);
  const [refresh, setRefresh] = useState(false);
  const supabase = useSupabaseClient();
  const session = useSession();

  useEffect(() => {
    fperfil(session?.user.id, supabase, setProfile);
    setUser(session?.user.id);
    fFriends(supabase, session?.user.id, setFriends);
  }, [session?.user.id, supabase]);
  return (
    <UserContext.Provider
      value={{
        user,
        setUser,
        profile,
        setProfile,
        friends,
        setFriends,
        posts,
        setPosts,
        savedPosts,
        setSavedPosts,
        refresh,
        setRefresh,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};
