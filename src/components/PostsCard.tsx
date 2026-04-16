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
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      <Card>
        {/* Header */}
        <div className="flex relative items-center mt-2">
          <Link className="cursor-pointer hover:opacity-80 transition-opacity" href={`/profile/${authorProfile.id}`}>
            <Avatar url={authorProfile?.avatar} />
          </Link>
          <div className="grow pl-3">
            <p className="text-[color:var(--text-primary)] font-medium text-sm">
              {authorProfile?.name}{" "}
              <span className="text-[color:var(--text-secondary)] font-normal">compartió un post</span>
            </p>
            <p className="text-[color:var(--text-muted)] text-xs mt-0.5">
              Hace {formatDistanceToNow(fecha, { locale: es })}
              {tagged && tagged.length > 0 && (
                <span className="ml-2 text-[color:var(--accent-gold)]">
                  con {tagged[0]?.label}
                </span>
              )}
            </p>
          </div>

          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                type="button"
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 focus:outline-none transition-colors"
                aria-label="Opciones"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-[color:var(--text-secondary)]">
                  <path fillRule="evenodd" d="M10.5 6a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm0 6a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm0 6a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Z" clipRule="evenodd" />
                </svg>
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                className="z-50 min-w-[160px] glass-card rounded-lg shadow-xl py-1 text-sm"
                sideOffset={5}
                align="end"
              >
                <DropdownMenu.Item
                  className="px-4 py-2.5 cursor-pointer text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] hover:bg-white/5 outline-none transition-colors"
                  onSelect={handleToggleSave}
                >
                  {isSaved ? "Quitar guardado" : "Guardar post"}
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className="px-4 py-2.5 cursor-pointer text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] hover:bg-white/5 outline-none transition-colors"
                  onSelect={() => {}}
                >
                  Activar notificación
                </DropdownMenu.Item>
                {isOwn && (
                  <>
                    <DropdownMenu.Separator className="h-px bg-white/10 my-1" />
                    <DropdownMenu.Item
                      className="px-4 py-2.5 cursor-pointer text-red-400 hover:bg-red-500/10 outline-none transition-colors"
                      onSelect={() => {}}
                    >
                      Borrar post
                    </DropdownMenu.Item>
                  </>
                )}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>

        {/* Content */}
        <p className="py-4 text-[color:var(--text-primary)] leading-relaxed">{content}</p>

        {/* Media */}
        {photos && photos.length > 0 && (
          <div className="flex gap-3 justify-center flex-wrap rounded-lg overflow-hidden -mx-5 md:-mx-8">
            {photos.map((photo) => (
              <div key={photo.id} className="w-full">
                {photo.tipo === "image/jpeg" && (
                  <img src={photo.url} className="w-full max-h-[480px] object-cover" alt="" />
                )}
                {photo.tipo === "video/mp4" && (
                  <video autoPlay muted controls className="w-full max-h-[480px] object-cover">
                    <source src={photo.url} />
                  </video>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="pt-4 flex gap-4 items-center border-t border-white/5 mt-2">
          <button
            type="button"
            className="flex items-center gap-1.5 text-sm text-[color:var(--text-secondary)] hover:text-[color:var(--accent)] transition-colors"
            onClick={handleLikeClick}
          >
            <AnimatePresence mode="wait" initial={false}>
              {alreadyLiked ? (
                <motion.span
                  key="liked"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                  transition={{ duration: 0.2, type: "spring", stiffness: 400 }}
                  className="text-lg heartbeat"
                >
                  💜
                </motion.span>
              ) : (
                <motion.span
                  key="unliked"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="text-lg"
                >
                  🤍
                </motion.span>
              )}
            </AnimatePresence>
            <span>{likes.length}</span>
          </button>

          <button type="button" className="flex items-center gap-1.5 text-sm text-[color:var(--text-secondary)] hover:text-[color:var(--accent)] transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <path fillRule="evenodd" d="M4.804 21.644A6.707 6.707 0 0 0 6 21.75a6.721 6.721 0 0 0 3.583-1.029c.774.182 1.584.279 2.417.279 5.322 0 9.75-3.97 9.75-9 0-5.03-4.428-9-9.75-9s-9.75 3.97-9.75 9c0 2.409 1.025 4.587 2.674 6.192.232.226.277.428.254.543a3.73 3.73 0 0 1-.814 1.686.75.75 0 0 0 .44 1.223ZM8.25 10.875a1.125 1.125 0 1 0 0 2.25 1.125 1.125 0 0 0 0-2.25ZM10.875 12a1.125 1.125 0 1 1 2.25 0 1.125 1.125 0 0 1-2.25 0Zm4.875-1.125a1.125 1.125 0 1 0 0 2.25 1.125 1.125 0 0 0 0-2.25Z" clipRule="evenodd" />
            </svg>
            <span>{comments.length}</span>
          </button>
        </div>

        {/* Comments */}
        {comments.length > 0 && (
          <div className="mt-3 space-y-2">
            {comments.map((comment) => (
              <div
                key={comment.id}
                className="flex items-start gap-3 bg-white/5 rounded-xl p-3 border border-white/5"
              >
                <Avatar url={comment.profiles.avatar} size="md" />
                <div>
                  <div className="flex items-center gap-2">
                    <Link className="text-sm font-medium text-[color:var(--text-primary)] hover:text-[color:var(--accent)] transition-colors" href={`/profile/${comment.profiles.id}`}>
                      {comment.profiles.name}
                    </Link>
                    <span className="text-[color:var(--text-muted)] text-xs">
                      · {formatDistanceToNow(new Date(comment.created_at), { locale: es })}
                    </span>
                  </div>
                  <p className="text-[color:var(--text-secondary)] text-sm mt-0.5">{comment.content}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Comment input */}
        <div className="flex mt-4 gap-3 items-center">
          <Avatar url={session?.user?.user_metadata?.avatar_url} size="sm" />
          <form onSubmit={postComment} className="flex-1">
            <input
              className="army-input w-full px-4 py-2.5 text-sm rounded-xl"
              placeholder="Deja un comentario..."
              value={commentText}
              onChange={(ev) => setCommentText(ev.target.value)}
            />
          </form>
        </div>
      </Card>
    </motion.div>
  );
};

export default PostsCard;
