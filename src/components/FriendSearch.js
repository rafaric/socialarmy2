import React, { useState, useEffect } from "react";
import { AutoComplete, Tag } from "antd";
import { useSession, useSupabaseClient } from "@supabase/auth-helpers-react";

const FriendSelector = ({ onSelect, selectedFriends, setSelectedFriends }) => {
  const supabase = useSupabaseClient();
  const [options, setOptions] = useState([]);

  const [inputValue, setInputValue] = useState("");
  const session = useSession();

  const fetchFriends = async () => {
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("*");

    if (error) {
      console.log(error);
      return;
    }

    const { data: friends } = await supabase
      .from("friends")
      .select("friend_id")
      .eq("user_id", session.user.id); // Reemplazar USER_ID con el ID del usuario logueado

    const friendNames = profiles
      .filter((p) => friends.some((f) => f.friend_id === p.id))
      .map((p) => ({ label: p.name, value: p.id }));
    setOptions(friendNames);
  };

  useEffect(() => {
    fetchFriends();
  }, []);

  const handleSelect = (value, option) => {
    const friend = { value: option.value, label: option.label };
    if (!selectedFriends.some((f) => f.value === friend.value)) {
      setSelectedFriends((prev) => [...prev, friend]);
      onSelect([...selectedFriends, friend]);
      setInputValue("");
    }
  };

  const handleRemoveFriend = (friend) => {
    const filteredFriends = selectedFriends.filter(
      (f) => f.value !== friend.value
    );
    setSelectedFriends(filteredFriends);
    onSelect(filteredFriends);
  };

  return (
    <>
      <AutoComplete
        options={options}
        onSelect={handleSelect}
        placeholder="Buscar amigos"
        style={{ minWidth: 200, maxWidth: 240 }}
        onSearch={(value) => setInputValue(value)}
        value={inputValue}
        allowClear
      />
      <div>
        {selectedFriends &&
          selectedFriends.map((friend) => (
            <Tag
              key={friend.value}
              closable
              onClose={() => handleRemoveFriend(friend)}
            >
              {friend.label}
            </Tag>
          ))}
      </div>
    </>
  );
};

export default FriendSelector;
