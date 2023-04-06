/* eslint-disable @next/next/no-img-element */
import { useContext, useEffect, useState } from "react";
import Avatar from "./Avatar";
import { useSession, useSupabaseClient } from "@supabase/auth-helpers-react";
import { crearPost, addPhotos, fposts, fFriends } from "@/utils/fperfil";
import FriendSelector from "./FriendSearch";
import Link from "next/link";
import { UserContext } from "@/contexts/UserContext";

const PostForm = ({ profile }) => {
  const [showModal, setShowModal] = useState(false);
  const session = useSession();
  const supabase = useSupabaseClient();
  const [content, setContent] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploads, setUploads] = useState([]);
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [amigos, setAmigos] = useState(false);
  const [friends, setFriends] = useState([]);
  const { refresh, setRefresh } = useContext(UserContext);

  useEffect(() => {
    fFriends(supabase, session.user.id, setFriends);
  }, []);
  const handleModal = async (close) => {
    if (close === "close") {
      setShowModal(!showModal);
      setUploads([]);
    } else {
      setShowModal(!showModal);

      if (showModal) {
        crearPost(
          supabase,
          session.user.id,
          content,
          uploads,
          setContent,
          setUploads,
          selectedFriends,
          setSelectedFriends,
          friends
        ).then(() => {
          setShowModal(!showModal);
          setRefresh(true);
        });

        // fFriends(supabase, session.user.id);
      }
    }
  };

  const handleInput = (e) => {
    setContent(e.target.value);
  };
  const handleSelect = (e) => console.log(e);

  return (
    <div className="flex flex-col bg-gray-100 border border-gray-300 rounded-lg p-4 mb-6">
      <div className="flex items-center">
        <Link href={`/profile/${profile?.id}`}>
          <Avatar
            url={
              profile?.avatar
                ? profile.avatar
                : `https://api.multiavatar.com/${profile?.name}.svg`
            }
            className="w-10 h-10 rounded-full mr-4"
          />
          {/* <img src={"https://api.multiavatar.com/Pepe.svg"} alt="" /> */}
        </Link>
        <div className="flex flex-col justify-between flex-1">
          <p className="px-4 text-xl font-bold py-3">
            Bienvenido/a {profile?.name.split(" ", 1)}!!!
          </p>
          <input
            className="w-full rounded-full px-4 py-2 mb-4 border border-gray-300 text-gray-700 leading-tight focus:outline-none focus:shadow-outline-purple"
            type="text"
            placeholder="¿En qué estás pensando?"
            onClick={() => handleModal("")}
          />
        </div>
      </div>
      <div className="flex mt-4 justify-between">
        <div className="flex">
          <button className="mr-2">
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
                d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
              />
            </svg>
          </button>
          <button className="mr-2">
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
                d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z"
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
                d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
              />
            </svg>
          </button>
        </div>
        <button className="bg-purple-600 text-white rounded-full px-4 py-2">
          Publicar
        </button>
      </div>
      {showModal && (
        <div className="fixed top-0 left-0 w-full h-full bg-gray-800 bg-opacity-50 flex items-center justify-center z-50 transition duration-1000 ease-out">
          <div className="bg-white rounded-lg p-8 min-w-fit relative text-center max-w-full">
            <p className="text-lg font-bold text-purple-700">
              Crear publicación
            </p>
            <button
              className="absolute top-8 right-2 hover:bg-purple-200 py-1 px-3 rounded-full cursor-pointer transition-all duration-700"
              onClick={() => handleModal("close")}
            >
              X
            </button>
            <div className="flex flex-col items-center my-4 gap-4 border-t-2 border-purple-400 pt-2">
              <div className="flex items-start py-4 gap-4">
                <Avatar
                  url={profile?.avatar}
                  // className="w-10 h-10 rounded-full mr-4"
                  size="sm"
                />
                <p>{profile?.name}</p>
              </div>
              <div className="flex-1">
                <textarea
                  rows="6"
                  cols="50"
                  className="w-full rounded-md px-2 py-2 border border-gray-300 text-gray-700 leading-tight focus:outline-none focus:shadow-outline-purple"
                  type="text"
                  placeholder="¿En qué estás pensando?"
                  onChange={handleInput}
                />
              </div>
            </div>

            {uploads.length > 0 && (
              <div className="inline-flex items-center">
                <div className="inline-flex gap-2 grow">
                  {/* <span className={isUploading ? "loader" : ""}></span> */}
                  {uploads.map((upload) => (
                    <div key={upload}>
                      <img
                        src={upload}
                        alt="up"
                        className="w-28 h-24 rounded-md"
                      />
                      <video className="w-28 h-24 rounded-md">
                        <source src={upload} />
                      </video>
                    </div>
                  ))}
                </div>
                {isUploading && <span className="loader"></span>}
              </div>
            )}

            <div className="flex mt-4 justify-between">
              <div className="flex items-center">
                <label htmlFor="images">
                  <div className="mr-2 cursor-pointer ">
                    {/* PHOTOS */}
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
                        d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
                      />
                    </svg>
                    <input
                      id="images"
                      type="file"
                      accept=".jpg, .gif, .mp4, .webm"
                      className="hidden"
                      onChange={(ev) => {
                        addPhotos(ev, supabase, setUploads, setIsUploading);
                      }}
                      multiple
                    />
                  </div>
                </label>
                <button onClick={() => setAmigos(!amigos)} className="mr-2">
                  {/* AMIGOS */}
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
                      d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                </button>
                {amigos && (
                  <div className="flex flex-col transition-all duration-700 mr-3">
                    <FriendSelector
                      onSelect={handleSelect}
                      selectedFriends={selectedFriends}
                      setSelectedFriends={setSelectedFriends}
                    />
                  </div>
                )}
                <button
                // onClick={}
                >
                  {/*LOCATION */}
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
                      d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
                    />
                  </svg>
                </button>
              </div>
              <button
                className="bg-purple-600 text-white rounded-full px-4 py-2 pb-8 h-8 align-middle"
                onClick={() => handleModal("")}
              >
                Publicar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PostForm;
