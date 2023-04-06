import { createContext, useState } from "react";

export const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [friends, setFriends] = useState([]);
  const [posts, setPosts] = useState([]);
  const [savedPosts, setSavedPosts] = useState([]);
  const [refresh, setRefresh] = useState(false);

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
