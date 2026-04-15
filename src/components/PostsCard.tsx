import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";
import Avatar from "./Avatar";
import Card from "./Card";
import { useAuthStore } from "@/store/useAuthStore";
import {
  useLikes,
  useToggleLike,
  useComments,
  useAddComment,
  useIsSaved,
  useToggleSave,
} from "@/hooks/usePostActions";
import type { Post } from "@/types";

type PostsCardProps = Omit<Post, "author">;

const PostsCard = ({
  id,
  content,
  created_at,
  photos,
  tagged,
  profiles: authorProfile,
}: PostsCardProps) => {
  const { session, user } = useAuthStore();
  const [commentText, setCommentText] = useState("");

  const { data: likes = [] } = useLikes(id);
  const { data: comments = [] } = useComments(id);
  const { data: isSaved = false } = useIsSaved(id, user);

  const userLike = likes.find((l) => l.user_id === user);
  const alreadyLiked = !!userLike;

  const toggleLike = useToggleLike(id, authorProfile.id);
  const addComment = useAddComment(id, authorProfile.id);
  const toggleSave = useToggleSave(id);

  function handleLikeClick() {
    if (!user) return;
    toggleLike.mutate({ userId: user, alreadyLiked, likeId: userLike?.id });
  }

  function handleToggleSave() {
    if (!user) return;
    toggleSave.mutate({ userId: user, isSaved });
  }

  async function postComment(ev: React.FormEvent) {
    ev.preventDefault();
    if (!user || !commentText.trim()) return;
    addComment.mutate({ userId: user, content: commentText });
    setCommentText("");
  }

  const fecha = new Date(created_at);
  const isOwn = authorProfile.id === user;

  return (
    <Card>
      {/* Header */}
      <div className="flex relative items-center mt-4">
        <Link className="cursor-pointer hover:opacity-70" href={`/profile/${authorProfile.id}`}>
          <Avatar url={authorProfile?.avatar} />
        </Link>
        <div className="grow pl-4">
          <p>
            {authorProfile?.name}{" "}
            <span className="text-gray-500">ha compartido un post</span>
          </p>
          <p className="font-light text-gray-400 text-xs">
            Hace {formatDistanceToNow(fecha, { locale: es })}
            {tagged && tagged.length > 0 && (
              <small className="px-1 text-gray-400 font-semibold">
                Con{" "}
                <span className="hover:text-gray-700 cursor-default hover:font-bold">
                  {tagged[0]?.label}
                </span>
              </small>
            )}
          </p>
        </div>

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button type="button" className="w-8 h-8 flex items-center justify-center rounded-md hover:border hover:border-purple-400 hover:shadow-md focus:outline-none" aria-label="Opciones">
              <img src="/assets/icons/menu-dots-vertical.png" alt="" className="w-5 h-5" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className="z-50 min-w-[140px] bg-white rounded-md shadow-lg border border-gray-100 py-1 text-sm" sideOffset={5} align="end">
              <DropdownMenu.Item className="px-4 py-2 cursor-pointer hover:bg-purple-50 hover:text-purple-700 outline-none" onSelect={handleToggleSave}>
                {isSaved ? "Quitar guardado" : "Guardar post"}
              </DropdownMenu.Item>
              <DropdownMenu.Item className="px-4 py-2 cursor-pointer hover:bg-purple-50 hover:text-purple-700 outline-none" onSelect={() => {}}>
                Activar notificación
              </DropdownMenu.Item>
              {isOwn && (
                <DropdownMenu.Item className="px-4 py-2 cursor-pointer hover:bg-red-50 hover:text-red-600 outline-none" onSelect={() => {}}>
                  Borrar post
                </DropdownMenu.Item>
              )}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>

      {/* Content */}
      <p className="px-1 py-5">{content}</p>

      {/* Media */}
      {photos && photos.length > 0 && (
        <div className="flex gap-4 justify-center flex-wrap">
          {photos.map((photo) => (
            <div className="w-[500px] rounded-md overflow-hidden" key={photo.id}>
              {photo.tipo === "image/jpeg" && (
                <img src={photo.url} className="w-full max-h-[400px] object-cover" alt="" />
              )}
              {photo.tipo === "video/mp4" && (
                <video autoPlay muted controls className="w-full max-h-[400px] object-cover">
                  <source src={photo.url} />
                </video>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="pt-4 flex gap-3 text-lg items-center">
        <button type="button" className="flex items-center gap-1 cursor-pointer" onClick={handleLikeClick}>
          <AnimatePresence mode="wait" initial={false}>
            {alreadyLiked ? (
              <motion.img key="liked" src="/assets/icons/heart.png" alt="" className="w-7 heartbeat"
                initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }}
                transition={{ duration: 0.2, type: "spring", stiffness: 400 }} />
            ) : (
              <motion.img key="unliked" src="/assets/icons/heart-empty.png" alt="" className="w-7"
                initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }}
                transition={{ duration: 0.15 }} />
            )}
          </AnimatePresence>
          {likes.length}
        </button>
        <span className="flex items-center gap-1">
          <img className="w-8" src="/assets/icons/chat.png" alt="" />
          {comments.length}
        </span>
      </div>

      {/* Comments */}
      <div className="inline-block min-w-[40%]">
        {comments.map((comment) => (
          <div key={comment.id} className="min-w-[40%] items-center bg-purple-100 flex gap-4 rounded-full my-4 p-1 border border-purple-200">
            <Avatar url={comment.profiles.avatar} size="md" />
            <div className="flex flex-col">
              <div>
                <Link className="hover:underline hover:text-purple-500" href={`/profile/${comment.profiles.id}`}>
                  {comment.profiles.name}
                </Link>
                <span className="text-gray-400 text-sm">
                  {" "}- Hace {formatDistanceToNow(new Date(comment.created_at), { locale: es })}
                </span>
              </div>
              <p className="text-gray-500 italic">{comment.content}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Comment input */}
      <div className="flex mt-3 gap-4 items-center">
        <Avatar url={session?.user?.user_metadata?.avatar_url} size="sm" />
        <div className="relative border grow rounded-full">
          <form onSubmit={postComment}>
            <input
              className="block w-full p-3 overflow-hidden h-12 rounded-full focus:outline-none focus:ring-2 focus:ring-purple-300"
              placeholder="Deja un comentario..."
              value={commentText}
              onChange={(ev) => setCommentText(ev.target.value)}
            />
          </form>
        </div>
      </div>
    </Card>
  );
};

export default PostsCard;
