import React from "react";

function Card({ children, noPadding, type }) {
  let classy = "bg-white shadow-md shadow-purple-500 mb-5 rounded-md";
  if (!noPadding) {
    classy += " py-2 md:px-8 px-6";
  }
  if (type) {
    classy +=
      " flex flex-col justify-around h-fit py-12 items-center gap-8 w-[80%] my-3 mx-auto";
  }

  return <div className={classy}>{children}</div>;
}

export default Card;
