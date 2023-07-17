import React from "react";
import { useState, useEffect } from "react";
import Avatar from "./Avatar";
import Card from "./Card";
import { useSpring, animated } from "react-spring";
import { Dropdown } from "antd";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";
import { useSession } from "@supabase/auth-helpers-react";
import {
  fComments,
  fIsSaved,
  fLikes,
  fUserLikes,
  toggleSave,
} from "@/utils/fetching";
import { useSupabaseClient } from "@supabase/auth-helpers-react/dist";

const PostsCard = ({
  id,
  content,
  created_at,
  photos,
  tagged,
  profiles: authorProfile,
}) => {
  const supabase = useSupabaseClient();
  const [likes, setLikes] = useState([]);
  const [alreadyLiked, setAlreadyLiked] = useState(false);
  const [savedPost, setSavedPost] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const session = useSession();
  const imageSpring = useSpring({
    opacity: alreadyLiked ? 1 : 0,
    transform: alreadyLiked ? "scale(1.1)" : "scale(1)",
  });

  useEffect(() => {
    fLikes(supabase, id, setLikes);
    fUserLikes(supabase, id, session?.user.id, setAlreadyLiked);
    fComments(supabase, id, setComments);
    fIsSaved(supabase, id, session?.user.id, setSavedPost);
    imageSpring.opacity.set(1);
    imageSpring.transform.set(alreadyLiked ? "scale(1.1)" : "scale(1)");
  }, [session]);

  async function postComment(ev) {
    ev.preventDefault();
    supabase
      .from("posts")
      .insert({
        content: commentText,
        author: session.user.id,
        parent: id,
      })
      .then((result) => {
        fComments(supabase, id, setComments);
        setCommentText("");
      });
    await supabase.from("notifications").insert([
      {
        notification_type: "comentario",
        user_emisor: session.user.id,
        user_receptor: authorProfile.id,
        post_id: id,
      },
    ]);
  }

  const items = [
    {
      label: (
        <a
          onClick={(e) => {
            e.preventDefault();
            toggleSave(savedPost, setSavedPost, supabase, id, session.user.id);
          }}
          href="#"
        >
          {savedPost ? "Quitar" : "Guardar Post"}
        </a>
      ),
      key: "0",
    },
    {
      label: <a href="#">Activar Notificación</a>,
      key: "1",
    },
    {
      label: (
        <a href="#">{authorProfile.id === session.user.id && "Borrar post"} </a>
      ),
      key: "2",
    },
  ];
  const fecha = new Date(created_at);
  function handleGuardar(e) {
    e.preventDefault();
  }
  async function handleLikeClick() {
    const { data } = await supabase
      .from("likes")
      .select("id")
      .eq("user_id", session.user.id)
      .eq("post_id", id);

    if (data && data?.length > 0) {
      // User already liked the post, remove like
      await supabase.from("likes").delete().eq("id", data[0].id);
      setAlreadyLiked(false);
    } else {
      // User did not like the post yet, add like
      await supabase
        .from("likes")
        .insert([{ post_id: id, user_id: session.user.id }]);
      setAlreadyLiked(true);
      await supabase.from("notifications").insert([
        {
          notification_type: "like",
          user_emisor: session.user.id,
          user_receptor: authorProfile.id,
          post_id: id,
        },
      ]);
    }

    // Update the number of likes in the UI
    /* const { data: likesData } = await supabase
      .from("likes")
      .select("id")
      .eq("post_id", id);
    setLikes(likesData.length); */
    fLikes(supabase, id, setLikes);
  }
  // console.log(tagged);
  return (
    <Card key={id}>
      <div className="flex relative items-center mt-4">
        <Link
          className="cursor-pointer hover:opacity-70"
          href={`/profile/${authorProfile.id}`}
        >
          <Avatar url={authorProfile?.avatar} />
        </Link>
        <div className="grow pl-4 ">
          <p>
            {authorProfile?.name}
            <Link
              href={"/profile/" + authorProfile?.id}
              className="font-semibold hover:underline cursor-pointer hover:text-purple-300"
            ></Link>{" "}
            ha compartido un post
          </p>
          <p className="font-light text-gray-400 text-xs">
            {/* <ReactTimeAgo date={new Date(post.created_at).getTime()} /> */}
            Hace {formatDistanceToNow(fecha, { locale: es })} -
            {tagged?.length > 0 && (
              <small className="px-1 py-5 text-gray-400 font-semibold">
                Con{" "}
                <span className="hover:text-gray-700 cursor-default hover:font-bold hover:scale-105 hover:transition-all hover:duration-500">
                  {tagged[0]?.label}
                </span>
              </small>
            )}
          </p>
        </div>
        <Dropdown menu={{ items }} trigger={["click"]} placement="bottomRight">
          <a onClick={(e) => e.preventDefault()}>
            <img
              src="/assets/icons/menu-dots-vertical.png"
              alt=""
              className="w-6 h-6 p-1 box-border hover:border hover:border-purple-400 hover:shadow-md focus:border-purple-400"
            />
          </a>
        </Dropdown>
      </div>
      <p className="px-1 py-5">{content}</p>

      {photos?.length > 0 && (
        <div className="flex gap-4 justify-center flex-wrap">
          {photos.map((photo) => (
            <div
              className="w-[500px] rounded-md overflow-hidden"
              key={photo.id}
            >
              {photo.tipo === "image/jpeg" && (
                <img
                  src={photo.url}
                  className="w-full max-h-[400px] object-cover overflow-hidden"
                  alt=""
                />
              )}
              {photo.tipo === "video/mp4" && (
                <video
                  autoPlay
                  muted
                  controls
                  className="w-full max-h-[400px] object-cover overflow-hidden"
                >
                  <source src={photo.url} />
                </video>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="pt-4 flex gap-3 text-lg items-center">
        <span className="flex items-center" onClick={handleLikeClick}>
          {!alreadyLiked && (
            <img
              className="inline w-7 mr-2 hover:scale-105 active:scale-95"
              src="/assets/icons/heart-empty.png"
              alt=""
            />
          )}
          {alreadyLiked && (
            <animated.img
              className="inline w-7 mr-2 hover:scale-105 active:scale-110 heartbeat"
              src="/assets/icons/heart.png"
              alt=""
              style={imageSpring}
            />
          )}

          {likes?.length}
        </span>
        <span className="flex items-center">
          <img
            className="inline w-8 mr-2"
            src="/assets/icons/chat.png"
            alt=""
          />
          {comments?.length}
        </span>
      </div>
      <div className="inline-block min-w-[40%]">
        {comments?.length > 0 &&
          comments.map((comment) => (
            <div
              key={comment.content}
              className="min-w-[40%] items-center bg-purple-100 flex gap-4 rounded-full my-4 p-1 border border-purple-200"
            >
              <div className="">
                <Avatar url={comment?.profiles.avatar} size="md" />
              </div>
              <div className="flex flex-col">
                <div>
                  <Link
                    className="hover:underline hover:text-purple-500"
                    href={"/profile/" + comment.profiles.id}
                  >
                    {comment.profiles.name}
                  </Link>
                  <span className="text-gray-400 text-sm">
                    {" "}
                    -{" "}
                    {/* <ReactTimeAgo
                      timeStyle={"twitter"}
                      date={new Date(comment.created_at).getTime()}
                    /> */}
                    Hace{" "}
                    {formatDistanceToNow(new Date(comment.created_at), {
                      locale: es,
                    })}
                  </span>
                </div>
                <p className="text-gray-500 italic">{comment.content}</p>
              </div>
            </div>
          ))}
      </div>
      <div className="flex mt-3 gap-4 items-center">
        <div className="">
          <Avatar url={session?.user.user_metadata.avatar_url} size="sm" />
        </div>
        <div className="relative border grow rounded-full">
          <form onSubmit={postComment}>
            <input
              className="block w-full p-3 overflow-hidden h-12 rounded-full"
              placeholder="Deja un comentario..."
              value={commentText}
              onChange={(ev) => setCommentText(ev.target.value)}
            />
          </form>
          {/* Boton para adjuntar una imagen */}
          {/* <button className="absolute right-4 top-3 text-gray-400">
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
          </button> */}
        </div>
      </div>
    </Card>
  );
};

export default PostsCard;
