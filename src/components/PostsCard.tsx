import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";
import Avatar from "./Avatar";
import Card from "./Card";
import Lightbox from "./Lightbox";
import { useAuthStore } from "@/store/useAuthStore";
import {
  useLikes,
  useToggleReaction,
  useComments,
  useAddComment,
  useIsSaved,
  useToggleSave,
  useDeletePost,
} from "@/hooks/usePostActions";
import { toast } from "sonner";
import { getEraByKey } from "@/lib/bts-eras";
import { BTS_DISCOGRAPHY } from "@/lib/bts-discography";
import { getMemberByKey } from "@/lib/bts-members";
import { REACTIONS } from "@/types";
import type { Post, ReactionType } from "@/types";

const CONTENT_CLAMP_LINES = 4;

type PostsCardProps = Omit<Post, "author"> & {
  bts_members?: string[] | null;
  forceExpanded?: boolean;
};

const PostsCard = ({
  id,
  content,
  created_at,
  photos,
  tagged,
  era,
  now_playing,
  bts_members,
  profiles: authorProfile,
  forceExpanded = false,
}: PostsCardProps) => {
  const { session, user } = useAuthStore();
  const [commentText, setCommentText] = useState("");
  const [showReactions, setShowReactions] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const imagePhotos = (photos ?? []).filter((p) => p.tipo === "image/jpeg" || p.tipo?.startsWith("image/"));

  const { data: likes = [] } = useLikes(id);
  const { data: comments = [] } = useComments(id);
  const { data: isSaved = false } = useIsSaved(id, user);

  const myLike = likes.find((l) => l.user_id === user);
  const toggleReaction = useToggleReaction(id, authorProfile.id);
  const addComment = useAddComment(id, authorProfile.id);
  const toggleSave = useToggleSave(id);
  const deletePost = useDeletePost(id);

  const eraData = era ? getEraByKey(era) : null;

  // Group reactions by type for display
  const reactionCounts = REACTIONS.map((r) => ({
    ...r,
    count: likes.filter((l) => l.reaction_type === r.type).length,
  })).filter((r) => r.count > 0);

  function handleReaction(type: ReactionType) {
    if (!user) return;
    toggleReaction.mutate({ userId: user, reactionType: type, existingLike: myLike });
    setShowReactions(false);
  }

  function handleToggleSave() {
    if (!user) return;
    toggleSave.mutate(
      { userId: user, isSaved },
      { onSuccess: () => toast.success(isSaved ? "Post quitado de guardados" : "Post guardado 🔖") }
    );
  }

  async function handleDelete() {
    await deletePost.mutateAsync();
    setDeleteConfirm(false);
    toast.success("Post eliminado");
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
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-[color:var(--text-muted)] text-xs">
                Hace {formatDistanceToNow(fecha, { locale: es })}
              </span>
              {tagged && tagged.length > 0 && (
                <span className="text-[color:var(--accent-gold)] text-xs">
                  · con {tagged[0]?.label}
                </span>
              )}
              {eraData && (
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full tracking-wide"
                  style={{
                    background: eraData.bg,
                    color: eraData.color,
                    border: `1px solid ${eraData.color}40`,
                  }}
                >
                  ✨ {eraData.label}
                </span>
              )}
            </div>
          </div>

          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button type="button" className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 focus:outline-none transition-colors" aria-label="Opciones">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-[color:var(--text-secondary)]">
                  <path fillRule="evenodd" d="M10.5 6a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm0 6a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm0 6a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Z" clipRule="evenodd" />
                </svg>
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content className="z-50 min-w-[160px] glass-card rounded-lg shadow-xl py-1 text-sm" sideOffset={5} align="end">
                <DropdownMenu.Item className="px-4 py-2.5 cursor-pointer text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] hover:bg-white/5 outline-none transition-colors" onSelect={handleToggleSave}>
                  {isSaved ? "Quitar guardado" : "Guardar post"}
                </DropdownMenu.Item>
                <DropdownMenu.Item className="px-4 py-2.5 cursor-pointer text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] hover:bg-white/5 outline-none transition-colors" onSelect={() => {}}>
                  Activar notificación
                </DropdownMenu.Item>
                {isOwn && (
                  <>
                    <DropdownMenu.Separator className="h-px bg-white/10 my-1" />
                    <DropdownMenu.Item
                      className="px-4 py-2.5 cursor-pointer text-red-400 hover:bg-red-500/10 outline-none transition-colors"
                      onSelect={() => setDeleteConfirm(true)}
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
        <div className="py-4">
          <p
            className="text-[color:var(--text-primary)] leading-relaxed"
            style={
              !forceExpanded && !expanded
                ? {
                    display: "-webkit-box",
                    WebkitLineClamp: CONTENT_CLAMP_LINES,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }
                : undefined
            }
          >
            {content}
          </p>
          {!forceExpanded && content.length > 200 && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-1 text-xs font-medium transition-colors"
              style={{ color: "var(--accent)" }}
            >
              {expanded ? "Ver menos" : "Ver más"}
            </button>
          )}
        </div>

        {/* BTS members tagged */}
        {bts_members && bts_members.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap pb-3">
            {bts_members.map((key) => {
              const member = getMemberByKey(key);
              if (!member) return null;
              return (
                <div
                  key={key}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium"
                  style={{
                    background: `${member.color}18`,
                    border: `1px solid ${member.color}40`,
                    color: member.color,
                  }}
                >
                  <img src={member.photo} alt={member.name} className="w-4 h-4 rounded-full object-cover object-top" />
                  {member.name}
                </div>
              );
            })}
          </div>
        )}

        {/* Now Playing widget */}
        {now_playing && (
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-xl mb-3"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            {/* Album cover o barras animadas */}
            {(() => {
              const albumTitle = now_playing.split(" — ")[1];
              const album = BTS_DISCOGRAPHY.find(a => a.title === albumTitle);
              return album ? (
                <img src={album.cover} alt={album.title} className="w-10 h-10 rounded-lg object-cover shrink-0" />
              ) : (
                <div className="flex items-end gap-[3px] h-5 shrink-0">
                  {[1, 2, 3, 4].map((i) => (
                    <motion.div key={i} className="w-[3px] rounded-full"
                      style={{ background: "var(--accent)" }}
                      animate={{ height: ["40%", "100%", "60%", "90%", "40%"] }}
                      transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
                    />
                  ))}
                </div>
              );
            })()}
            {/* Barras animadas siempre visibles */}
            <div className="flex items-end gap-[3px] h-5 shrink-0">
              {[1, 2, 3, 4].map((i) => (
                <motion.div key={i} className="w-[3px] rounded-full"
                  style={{ background: "var(--accent)" }}
                  animate={{ height: ["40%", "100%", "60%", "90%", "40%"] }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
                />
              ))}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] tracking-widest text-[color:var(--text-muted)] uppercase mb-0.5">Now Playing</p>
              <p className="text-sm font-medium text-[color:var(--text-primary)] truncate">{now_playing}</p>
            </div>
          </div>
        )}

        {/* Media */}
        {photos && photos.length > 0 && (
          <div className="flex gap-3 justify-center flex-wrap rounded-lg overflow-hidden -mx-5 md:-mx-8">
            {photos.map((photo) => (
              <div key={photo.id} className="w-full">
                {(photo.tipo === "image/jpeg" || photo.tipo?.startsWith("image/")) && (
                  <button
                    type="button"
                    className="w-full focus:outline-none"
                    onClick={() => setLightboxIndex(imagePhotos.findIndex((p) => p.id === photo.id))}
                  >
                    <img
                      src={photo.url}
                      className="w-full max-h-[480px] object-cover cursor-zoom-in"
                      alt=""
                    />
                  </button>
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

        {/* Lightbox */}
        <AnimatePresence>
          {lightboxIndex !== null && imagePhotos.length > 0 && (
            <Lightbox
              photos={imagePhotos}
              index={lightboxIndex}
              onClose={() => setLightboxIndex(null)}
              onPrev={() => setLightboxIndex((i) => (i! - 1 + imagePhotos.length) % imagePhotos.length)}
              onNext={() => setLightboxIndex((i) => (i! + 1) % imagePhotos.length)}
            />
          )}
        </AnimatePresence>

        {/* Reaction counts */}
        {reactionCounts.length > 0 && (
          <div className="flex gap-2 pt-3 flex-wrap">
            {reactionCounts.map((r) => (
              <span
                key={r.type}
                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full"
                style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-secondary)" }}
              >
                <span>{r.emoji}</span>
                <span>{r.count}</span>
              </span>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="pt-3 flex gap-2 items-center border-t border-white/5 mt-2 relative">
          {/* Reaction button + popover */}
          <div className="relative">
            <button
              type="button"
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] hover:bg-white/5 transition-colors"
              onClick={() => setShowReactions((v) => !v)}
            >
              <span className="text-base">{myLike ? REACTIONS.find(r => r.type === myLike.reaction_type)?.emoji ?? "💜" : "🤍"}</span>
              <span>{likes.length}</span>
            </button>

            <AnimatePresence>
              {showReactions && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.85, y: 4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.85, y: 4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute bottom-full left-0 mb-2 glass-card px-2 py-1.5 flex gap-1 z-20"
                >
                  {REACTIONS.map((r) => (
                    <motion.button
                      key={r.type}
                      type="button"
                      title={r.label}
                      whileHover={{ scale: 1.3 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleReaction(r.type)}
                      className={`text-xl p-1 rounded-lg transition-colors ${
                        myLike?.reaction_type === r.type ? "bg-white/15" : "hover:bg-white/10"
                      }`}
                    >
                      {r.emoji}
                    </motion.button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button type="button" className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] hover:bg-white/5 transition-colors">
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
              <div key={comment.id} className="flex items-start gap-3 bg-white/5 rounded-xl p-3 border border-white/5">
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

        {/* Delete confirmation */}
        <AnimatePresence>
          {deleteConfirm && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-4 flex items-center justify-between p-3 rounded-xl"
              style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}
            >
              <p className="text-sm text-red-400">¿Borrar este post?</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deletePost.isPending}
                  className="text-xs px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50"
                >
                  {deletePost.isPending ? "Borrando..." : "Sí, borrar"}
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(false)}
                  className="text-xs px-3 py-1.5 rounded-lg hover:bg-white/5 text-[color:var(--text-muted)] transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
};

export default PostsCard;
