import React, { useState, useEffect } from "react";
import { Input, Tag } from "antd";
import { useSession, useSupabaseClient } from "@supabase/auth-helpers-react";
import { fFriends } from "@/utils/fetching";

const FriendSearch = () => {
  const [searchText, setSearchText] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [selectedFriends, setSelectedFriends] = useState([]);
  const session = useSession();
  const supabase = useSupabaseClient();

  useEffect(() => {
    const fetchFriends = async () => {
      const { data: friends, error } = await supabase
        .from("friends, profiles")
        .select("profiles.nombre, profiles.avatar, friends.friend_id")
        .limit(10)
        .ilike("profiles.nombre", `%${searchText}%`)
        .eq("friends.user_id", session.user.id)
        .select("*", {
          foreignTable: "profiles",
          as: "friendProfile",
          on: "friend_id=id",
        });
      if (error) console.log("Error fetching friends:", error);
      else setSuggestions(friends);
    };

    if (searchText !== "") {
      fetchFriends();
    } else {
      setSuggestions([]);
    }

    /* Try changing 'profiles' to one of the following: 'profiles!friends_friend_id_fkey', 'profiles!friends_user_id_fkey'. Find the desired relationship in the 'details' key. */
    if (searchText !== "") fetchFriends();
    else setSuggestions([]);
  }, [searchText]);

  const handleInputChange = (e) => {
    setSearchText(e.target.value);
    console.log(suggestions);
  };

  const handleFriendClick = (friend) => {
    if (!selectedFriends.includes(friend)) {
      setSelectedFriends([...selectedFriends, friend]);
      setSearchText("");
    }
  };
  const handleTagClose = (friendName) => {
    setSelectedFriends(selectedFriends.filter((f) => f.name !== friendName));
  };

  return (
    <div>
      <Input value={searchText} onChange={handleInputChange} />
      {suggestions?.length > 0 &&
        suggestions.map((friend) => (
          <div key={friend.id} onClick={() => handleFriendClick(friend)}>
            {" "}
            {friend.nombre}
          </div>
        ))}

      {selectedFriends.map((friend) => (
        <Tag
          key={friend.id}
          closable
          onClose={() => handleTagClose(friend.nombre)}
        >
          {friend.nombre}
        </Tag>
      ))}
    </div>
  );
};

export default FriendSearch;
