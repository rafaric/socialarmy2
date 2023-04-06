import React from "react";

const Avatar = ({ url, size }) => {
  !url ? (url = "https://via.placeholder.com/50x50") : (url = url);
  let tamanio;

  if (!size) {
    tamanio = "w-20";
  } else if (size === "sm") {
    tamanio = "w-10";
  } else if (size === "md") {
    tamanio = "w-12";
  }

  return (
    <div className={`rounded-full overflow-hidden flex cursor-pointer `}>
      <img src={url} alt={url} className={tamanio} />
    </div>
  );
};

export default Avatar;
