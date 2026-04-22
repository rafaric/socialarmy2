import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";
import Avatar from "./Avatar";
import Card from "./Card";
import Lightbox from "./Lightbox";
import StickerPicker from "./StickerPicker";
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
import PollDisplay from "@/components/PollDisplay";
import { getMemberByKey } from "@/lib/bts-members";
import { REACTIONS } from "@/types";
import type { Post, ReactionType } from "@/types";
import { DEMO_USER_ID } from "@/lib/constants";

const CONTENT_CLAMP_LINES = 4;

type PostsCardProps = Omit<Post, "author"> & {
  bts_members?: string[] | null;
  forceExpanded?: boolean;
  source_url?: string | null;
  source_label?: string | null;
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
  poll,
  profiles: authorProfile,
  forceExpanded = false,
  source_url,
  source_label,
}: PostsCardProps) => {
  const { session, user } = useAuthStore();
  const isReadOnly = !user || user === DEMO_USER_ID;
  const [commentText, setCommentText] = useState("");
  const [commentSticker, setCommentSticker] = useState<string | null>(null);
  const [showStickers, setShowStickers] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const stickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showStickers) return;
    function onOutside(e: MouseEvent) {
      if (stickerRef.current && !stickerRef.current.contains(e.target as Node)) {
        setShowStickers(false);
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [showStickers]);

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
    if (!user || (!commentText.trim() && !commentSticker)) return;
    addComment.mutate({ userId: user, content: commentText, stickerUrl: commentSticker ?? undefined });
    setCommentText("");
    setCommentSticker(null);
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
              <DropdownMenu.Content className="z-50 min-w-[160px] glass-card rounded-lg shadow-xl py-1 text-sm" style={{ background: "rgba(13,10,25,0.93)", backdropFilter: "none", WebkitBackdropFilter: "none" }} sideOffset={5} align="end">
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

        {/* Delete confirmation — top of card */}
        <AnimatePresence>
          {deleteConfirm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div
                className="mt-3 flex items-center justify-between p-3 rounded-xl"
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
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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
                  <Image src={member.photo} alt={member.name} width={16} height={16} className="w-4 h-4 rounded-full object-cover object-top" sizes="16px" />
                  {member.name}
                </div>
              );
            })}
          </div>
        )}

        {/* Poll */}
        {poll && (
          <PollDisplay poll={poll} postId={id} authorId={authorProfile.id} />
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
                <Image src={album.cover} alt={album.title} width={40} height={40} className="w-10 h-10 rounded-lg object-cover shrink-0" sizes="40px" />
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
          <PhotoGrid photos={photos} imagePhotos={imagePhotos} onImageClick={setLightboxIndex} />
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

        {/* Source attribution */}
        {source_url && (
          <a
            href={source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 mt-2 w-fit group"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-[color:var(--text-muted)] group-hover:text-[color:var(--accent)] transition-colors shrink-0">
              <path fillRule="evenodd" d="M19.902 4.098a3.75 3.75 0 0 0-5.304 0l-4.5 4.5a3.75 3.75 0 0 0 1.035 6.037.75.75 0 0 1-.646 1.353 5.25 5.25 0 0 1-1.449-8.45l4.5-4.5a5.25 5.25 0 1 1 7.424 7.424l-1.757 1.757a.75.75 0 1 1-1.06-1.06l1.757-1.757a3.75 3.75 0 0 0 0-5.304Zm-7.389 4.267a.75.75 0 0 1 1-.353 5.25 5.25 0 0 1 1.449 8.45l-4.5 4.5a5.25 5.25 0 1 1-7.424-7.424l1.757-1.757a.75.75 0 1 1 1.06 1.06l-1.757 1.757a3.75 3.75 0 1 0 5.304 5.304l4.5-4.5a3.75 3.75 0 0 0-.477-5.794.75.75 0 0 1-.354-1Z" clipRule="evenodd" />
            </svg>
            <span className="text-[10px] text-[color:var(--text-muted)] group-hover:text-[color:var(--accent)] transition-colors truncate max-w-[240px]">
              {(() => {
                const domain = (() => { try { return new URL(source_url!).hostname.replace(/^www\./, ""); } catch { return source_url!; } })();
                return source_label ? `Vía ${source_label} · ${domain}` : `Vía ${domain}`;
              })()}
            </span>
          </a>
        )}

        {/* Reaction counts */}
        {reactionCounts.length > 0 && (
          <div className="flex gap-2 pt-3 flex-wrap" aria-label="Reacciones al post">
            {reactionCounts.map((r) => (
              <motion.span
                key={r.type}
                layout
                aria-label={`${r.count} ${r.label}`}
                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full cursor-default"
                style={{ background: myLike?.reaction_type === r.type ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)", color: "var(--text-secondary)" }}
              >
                <motion.span
                  aria-hidden="true"
                  key={`${r.type}-${r.count}`}
                  initial={{ scale: 1.6, rotate: -10 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 15 }}
                >
                  {r.emoji}
                </motion.span>
                <motion.span
                  key={r.count}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  {r.count}
                </motion.span>
              </motion.span>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="pt-3 flex gap-2 items-center border-t border-white/5 mt-2 relative">
          {/* Reaction button + popover */}
          <div className="relative">
            <button
              type="button"
              aria-label={myLike ? `Cambiar reacción (actualmente ${REACTIONS.find(r => r.type === myLike.reaction_type)?.label ?? "reacción"})` : "Reaccionar al post"}
              aria-expanded={user ? showReactions : undefined}
              aria-haspopup={user ? "true" : undefined}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] hover:bg-white/5 transition-colors"
              onClick={() => !isReadOnly ? setShowReactions((v) => !v) : window.location.href = "/login"}
            >
              <span className="text-base" aria-hidden="true">{myLike ? REACTIONS.find(r => r.type === myLike.reaction_type)?.emoji ?? "💜" : "🤍"}</span>
              <span aria-label={`${likes.length} reacciones`}>{likes.length}</span>
            </button>

            <AnimatePresence>
              {showReactions && (
                <motion.div
                  role="menu"
                  aria-label="Elegir reacción"
                  initial={{ opacity: 0, scale: 0.85, y: 4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.85, y: 4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute bottom-full left-0 mb-2 glass-card px-2 py-1.5 flex gap-1 z-20"
                >
                  {REACTIONS.map((r, i) => (
                    <motion.button
                      key={r.type}
                      type="button"
                      role="menuitem"
                      aria-label={r.label}
                      aria-pressed={myLike?.reaction_type === r.type}
                      initial={{ opacity: 0, y: 8, scale: 0.6 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ delay: i * 0.04, type: "spring", stiffness: 350, damping: 20 }}
                      whileHover={{ scale: 1.4, y: -4 }}
                      whileTap={{ scale: 0.85 }}
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

          <button
            type="button"
            aria-label={`${comments.length} comentario${comments.length !== 1 ? "s" : ""}`}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] hover:bg-white/5 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" aria-hidden="true" focusable="false">
              <path fillRule="evenodd" d="M4.804 21.644A6.707 6.707 0 0 0 6 21.75a6.721 6.721 0 0 0 3.583-1.029c.774.182 1.584.279 2.417.279 5.322 0 9.75-3.97 9.75-9 0-5.03-4.428-9-9.75-9s-9.75 3.97-9.75 9c0 2.409 1.025 4.587 2.674 6.192.232.226.277.428.254.543a3.73 3.73 0 0 1-.814 1.686.75.75 0 0 0 .44 1.223ZM8.25 10.875a1.125 1.125 0 1 0 0 2.25 1.125 1.125 0 0 0 0-2.25ZM10.875 12a1.125 1.125 0 1 1 2.25 0 1.125 1.125 0 0 1-2.25 0Zm4.875-1.125a1.125 1.125 0 1 0 0 2.25 1.125 1.125 0 0 0 0-2.25Z" clipRule="evenodd" />
            </svg>
            <span aria-hidden="true">{comments.length}</span>
          </button>
        </div>

        {/* Comments */}
        {comments.length > 0 && (
          <div className="mt-3 space-y-2">
            {comments.map((comment) => (
              <div key={comment.id} className="flex items-start gap-3 bg-white/5 rounded-xl p-3 border border-white/5">
                <Avatar url={comment.profiles.avatar} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link className="text-sm font-medium text-[color:var(--text-primary)] hover:text-[color:var(--accent)] transition-colors" href={`/profile/${comment.profiles.id}`}>
                      {comment.profiles.name}
                    </Link>
                    <span className="text-[color:var(--text-muted)] text-xs">
                      · {formatDistanceToNow(new Date(comment.created_at), { locale: es })}
                    </span>
                  </div>
                  {comment.content && (
                    <p className="text-[color:var(--text-secondary)] text-sm mt-0.5">{comment.content}</p>
                  )}
                  {comment.sticker_url && (
                    <motion.div
                      initial={{ scale: 0.7, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 300, damping: 18 }}
                      className="mt-1.5 inline-block"
                    >
                      <Image
                        src={comment.sticker_url}
                        alt="sticker"
                        width={80}
                        height={80}
                        className="rounded-lg object-contain"
                        sizes="80px"
                      />
                    </motion.div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Comment input */}
        {!isReadOnly ? (
          <div className="flex mt-4 gap-3 items-start">
            <Avatar url={session?.user?.user_metadata?.avatar_url} size="sm" />
            <div className="flex-1">
              {/* Sticker preview */}
              <AnimatePresence>
                {commentSticker && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-2 relative inline-block"
                  >
                    <Image src={commentSticker} alt="sticker" width={64} height={64} className="rounded-lg object-contain" sizes="64px" />
                    <button
                      type="button"
                      onClick={() => setCommentSticker(null)}
                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center leading-none"
                    >
                      ×
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              <form onSubmit={postComment} className="flex gap-2 items-center">
                {/* Sticker button */}
                <div className="relative" ref={stickerRef}>
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setShowStickers((v) => !v)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors text-base"
                    aria-label="Elegir sticker"
                  >
                    🎭
                  </motion.button>
                  {showStickers && user && (
                    <StickerPicker
                      userId={user}
                      onSelect={(url) => setCommentSticker(url)}
                      onClose={() => setShowStickers(false)}
                    />
                  )}
                </div>

                <label htmlFor={`comment-${id}`} className="sr-only">Escribir comentario</label>
                <input
                  id={`comment-${id}`}
                  className="army-input flex-1 px-4 py-2.5 text-sm rounded-xl"
                  placeholder="Deja un comentario..."
                  value={commentText}
                  onChange={(ev) => setCommentText(ev.target.value)}
                  autoComplete="off"
                />
              </form>
            </div>
          </div>
        ) : (
          <a
            href="/login"
            className="block mt-4 text-center text-xs text-[color:var(--text-muted)] hover:text-[color:var(--accent)] transition-colors py-2"
          >
            Iniciá sesión para comentar 💜
          </a>
        )}

      </Card>
    </motion.div>
  );
};

export default PostsCard;

// ─── Photo Grid ───────────────────────────────────────────────────────────────

interface PhotoGridProps {
  photos: import("@/types").Photo[];
  imagePhotos: import("@/types").Photo[];
  onImageClick: (index: number) => void;
}

function PhotoGrid({ photos, imagePhotos, onImageClick }: PhotoGridProps) {
  const MAX_VISIBLE = 4;
  const visible = photos.slice(0, MAX_VISIBLE);
  const overflow = photos.length - MAX_VISIBLE;

  function lightboxIdx(photo: import("@/types").Photo) {
    return imagePhotos.findIndex((p) => p.id === photo.id);
  }

  function isImage(photo: import("@/types").Photo) {
    return photo.tipo?.startsWith("image/");
  }

  // Wrapper: padding horizontal, top margin, rounded container clips corner images
  const wrapCls = "mt-3 rounded-xl overflow-hidden";
  const gap = "gap-1.5";

  function renderMedia(photo: import("@/types").Photo) {
    if (isImage(photo)) {
      return (
        <button type="button" className="w-full h-full focus:outline-none" onClick={() => onImageClick(lightboxIdx(photo))}>
          <Image
            src={photo.url}
            alt=""
            fill
            sizes="(max-width: 768px) 50vw, 33vw"
            className="object-cover cursor-zoom-in"
          />
        </button>
      );
    }
    return (
      <video autoPlay muted controls className="w-full h-full object-cover">
        <source src={photo.url} />
      </video>
    );
  }

  // 1 photo — full width, rounded by wrapper
  if (photos.length === 1) {
    const photo = photos[0];
    return (
      <div className={wrapCls}>
        {isImage(photo) ? (
          <button type="button" className="w-full focus:outline-none" onClick={() => onImageClick(lightboxIdx(photo))}>
            <div className="relative w-full" style={{ maxHeight: 480, aspectRatio: "16/9", minHeight: 200 }}>
              <Image
                src={photo.url}
                alt=""
                fill
                sizes="(max-width: 768px) 100vw, 672px"
                className="object-cover cursor-zoom-in"
              />
            </div>
          </button>
        ) : (
          <video autoPlay muted controls className="w-full max-h-[480px] object-cover">
            <source src={photo.url} />
          </video>
        )}
      </div>
    );
  }

  // 2 photos — side by side
  if (photos.length === 2) {
    return (
      <div className={`${wrapCls} grid grid-cols-2 ${gap}`}>
        {photos.map((photo) => (
          <div key={photo.id} className="aspect-square relative">{renderMedia(photo)}</div>
        ))}
      </div>
    );
  }

  // 3 photos — 1 large left + 2 stacked right
  if (photos.length === 3) {
    return (
      <div className={`${wrapCls} grid grid-cols-2 ${gap}`} style={{ gridTemplateRows: "1fr 1fr" }}>
        <div className="row-span-2 relative" style={{ minHeight: 200 }}>{renderMedia(photos[0])}</div>
        {[photos[1], photos[2]].map((photo) => (
          <div key={photo.id} className="aspect-square relative">{renderMedia(photo)}</div>
        ))}
      </div>
    );
  }

  // 4+ photos — 2x2 grid, last cell has +N overlay
  return (
    <div className={`${wrapCls} grid grid-cols-2 ${gap}`}>
      {visible.map((photo, i) => {
        const isLast = i === MAX_VISIBLE - 1 && overflow > 0;
        return (
          <div key={photo.id} className="aspect-square relative">
            {renderMedia(photo)}
            {isLast && (
              <button
                type="button"
                className="absolute inset-0 flex items-center justify-center text-white text-2xl font-bold focus:outline-none"
                style={{ background: "rgba(0,0,0,0.55)" }}
                onClick={() => onImageClick(lightboxIdx(photo))}
              >
                +{overflow + 1}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
