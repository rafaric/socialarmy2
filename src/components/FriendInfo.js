import React from "react";
import Avatar from "./Avatar";

function FriendInfo({ friend }) {
  if (!friend.avatar) {
    url =
      "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2c/Default_pfp.svg/480px-Default_pfp.svg.png";
  }
  const fecha = new Date(friend.created_at);
  const desde =
    fecha.getDate() + "/" + (fecha.getMonth() + 1) + "/" + fecha.getFullYear();
  return (
    <div className="flex items-center gap-6 pb-2 mr-16 mb-5 border-b">
      <Avatar url={friend.avatar} />
      <div>
        <h3 className="font-bold">{friend.name}</h3>
        <p className="text-sm text-gray-400">Amigos desde el {desde}</p>
      </div>
    </div>
  );
}

export default FriendInfo;
