import React from "react";
import Avatar from "./Avatar";

function FriendInfo({ friend }) {
  if (!friend.avatar) {
    url =
      "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2c/Default_pfp.svg/480px-Default_pfp.svg.png";
  }

  return (
    <div className="flex items-center gap-6 pb-2 mr-16 mb-5 border-b">
      <Avatar url={friend.avatar} />
      <div>
        <h3 className="font-bold">{friend.name}</h3>
        <p className="text-sm text-gray-400">
          amigos desde el {new Date(friend.created_at).getDate.toString}
        </p>
      </div>
    </div>
  );
}

export default FriendInfo;
