import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Avatar from "./Avatar";
import FriendSelector from "./FriendSearch";
import Link from "next/link";
import { useAuthStore } from "@/store/useAuthStore";
import { useFriends } from "@/hooks/useFriends";
import { useCreatePost, useUploadPhotos } from "@/hooks/usePosts";
import { BTS_ERAS } from "@/lib/bts-eras";
import { BTS_DISCOGRAPHY } from "@/lib/bts-discography";
import type { Profile, Photo, TaggedFriend } from "@/types";

interface PostFormProps {
  profile: Profile | null;
}

const PostForm = ({ profile }: PostFormProps) => {
  const { user } = useAuthStore();
  const { data: friends = [] } = useFriends(user);
  const createPost = useCreatePost();
  const uploadPhotos = useUploadPhotos();

  const [showModal, setShowModal] = useState(false);
  const [content, setContent] = useState("");
  const [uploads, setUploads] = useState<Photo[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<TaggedFriend[]>([]);
  const [amigos, setAmigos] = useState(false);
  const [selectedEra, setSelectedEra] = useState<string | null>(null);
  const [showEraSelector, setShowEraSelector] = useState(false);
  const [selectedAlbum, setSelectedAlbum] = useState("");
  const [selectedTrack, setSelectedTrack] = useState("");
  const [showNowPlaying, setShowNowPlaying] = useState(false);
  const nowPlaying = selectedAlbum && selectedTrack ? `${selectedTrack} — ${BTS_DISCOGRAPHY.find(a => a.key === selectedAlbum)?.title}` : "";

  const isUploading = uploadPhotos.isPending;

  async function handlePublish() {
    if (!user) return;
    await createPost.mutateAsync({
      userId: user, content, uploads, selectedFriends, friends,
      era: selectedEra,
      nowPlaying: nowPlaying.trim() || null,
    });
    setShowModal(false);
    setContent("");
    setUploads([]);
    setSelectedFriends([]);
    setSelectedEra(null);
    setShowEraSelector(false);
    setSelectedAlbum("");
    setSelectedTrack("");
    setShowNowPlaying(false);
  }

  async function handleFileChange(ev: React.ChangeEvent<HTMLInputElement>) {
    if (!ev.target.files?.length) return;
    const newPhotos = await uploadPhotos.mutateAsync(ev.target.files);
    setUploads((prev) => [...prev, ...newPhotos]);
  }

  return (
    <>
      {/* Trigger */}
      <div className="glass-card py-4 px-5 mb-5 flex items-center gap-3">
        <Link href={`/profile/${profile?.id}`} className="shrink-0">
          <Avatar url={profile?.avatar} size="sm" ring />
        </Link>
        <button
          type="button"
          className="army-input flex-1 text-left px-4 py-2.5 text-sm text-[color:var(--text-muted)] rounded-full cursor-pointer"
          onClick={() => setShowModal(true)}
        >
          ¿En qué estás pensando, {profile?.name?.split(" ", 1)}?
        </button>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="shrink-0 btn-accent text-sm py-2 px-4 hidden md:block"
        >
          Publicar
        </button>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            key="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
            style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
            onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
          >
            <motion.div
              key="modal-panel"
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="glass-card w-full max-w-lg p-6"
            >
              {/* Modal header */}
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-[color:var(--text-primary)] font-semibold">Crear publicación</h2>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)] transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                    <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>

              {/* Author */}
              <div className="flex items-center gap-3 mb-4">
                <Avatar url={profile?.avatar} size="sm" ring />
                <span className="text-[color:var(--text-primary)] text-sm font-medium">{profile?.name}</span>
              </div>

              {/* Textarea */}
              <textarea
                rows={5}
                className="army-input w-full px-4 py-3 text-sm resize-none rounded-xl"
                placeholder="¿En qué estás pensando?"
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />

              {/* Media preview */}
              {(uploads.length > 0 || isUploading) && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {uploads.map((upload) => (
                    <div key={upload.id} className="rounded-lg overflow-hidden">
                      {upload.tipo === "image/jpeg" && (
                        <img src={upload.url} alt="preview" className="w-24 h-20 object-cover" />
                      )}
                      {upload.tipo === "video/mp4" && (
                        <video className="w-24 h-20 object-cover rounded-lg">
                          <source src={upload.url} />
                        </video>
                      )}
                    </div>
                  ))}
                  {isUploading && (
                    <div className="w-24 h-20 rounded-lg flex items-center justify-center bg-white/5">
                      <span className="loader" style={{ width: 28, height: 28 }} />
                    </div>
                  )}
                </div>
              )}

              {/* Tagged friends */}
              {amigos && (
                <div className="mt-3">
                  <FriendSelector
                    onSelect={setSelectedFriends}
                    selectedFriends={selectedFriends}
                    setSelectedFriends={setSelectedFriends}
                  />
                </div>
              )}

              {/* Now Playing */}
              <AnimatePresence>
                {showNowPlaying && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-3 overflow-hidden"
                  >
                    <div
                      className="flex flex-col gap-2 px-3 py-3 rounded-xl"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                    >
                      {/* Animated bars + label */}
                      <div className="flex items-center gap-2">
                        <div className="flex items-end gap-[3px] h-4 shrink-0">
                          {[1,2,3,4].map((i) => (
                            <motion.div key={i} className="w-[3px] rounded-full"
                              style={{ background: selectedTrack ? "var(--accent)" : "var(--text-muted)" }}
                              animate={selectedTrack ? { height: ["40%","100%","60%","90%","40%"] } : { height: "40%" }}
                              transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
                            />
                          ))}
                        </div>
                        <span className="text-[10px] tracking-widest text-[color:var(--text-muted)] uppercase">
                          {selectedTrack ? `${selectedTrack} — ${BTS_DISCOGRAPHY.find(a => a.key === selectedAlbum)?.title}` : "Elegí un álbum y canción"}
                        </span>
                        {(selectedAlbum || selectedTrack) && (
                          <button
                            type="button"
                            onClick={() => { setSelectedAlbum(""); setSelectedTrack(""); }}
                            className="ml-auto text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)] transition-colors text-xs"
                          >✕</button>
                        )}
                      </div>

                      {/* Album select */}
                      <select
                        value={selectedAlbum}
                        onChange={(e) => { setSelectedAlbum(e.target.value); setSelectedTrack(""); }}
                        className="army-input w-full px-3 py-2 text-sm rounded-lg appearance-none cursor-pointer"
                      >
                        <option value="">Álbum...</option>
                        {BTS_DISCOGRAPHY.map((album) => (
                          <option key={album.key} value={album.key}>
                            {album.title} ({album.year})
                          </option>
                        ))}
                      </select>

                      {/* Track select */}
                      <select
                        value={selectedTrack}
                        onChange={(e) => setSelectedTrack(e.target.value)}
                        disabled={!selectedAlbum}
                        className="army-input w-full px-3 py-2 text-sm rounded-lg appearance-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <option value="">Canción...</option>
                        {BTS_DISCOGRAPHY.find(a => a.key === selectedAlbum)?.tracks.map((track) => (
                          <option key={track} value={track}>{track}</option>
                        ))}
                      </select>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Era selector */}
              <AnimatePresence>
                {showEraSelector && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-3 overflow-hidden"
                  >
                    <p className="text-[10px] tracking-[0.2em] text-[color:var(--text-muted)] uppercase mb-2">
                      Era que inspira este post
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {BTS_ERAS.map((era) => (
                        <button
                          key={era.key}
                          type="button"
                          onClick={() => setSelectedEra(selectedEra === era.key ? null : era.key)}
                          className="px-3 py-1 rounded-full text-xs font-medium transition-all duration-200"
                          style={{
                            background: selectedEra === era.key ? era.bg : "rgba(255,255,255,0.05)",
                            color: selectedEra === era.key ? era.color : "var(--text-muted)",
                            border: `1px solid ${selectedEra === era.key ? era.color : "transparent"}`,
                            boxShadow: selectedEra === era.key ? `0 0 8px ${era.bg}` : "none",
                          }}
                        >
                          {era.label}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Actions bar */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/10">
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="images"
                    className="w-9 h-9 flex items-center justify-center rounded-lg cursor-pointer text-[color:var(--text-secondary)] hover:text-[color:var(--accent)] hover:bg-white/5 transition-colors"
                    title="Adjuntar imagen/video"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                      <path fillRule="evenodd" d="M1.5 6a2.25 2.25 0 0 1 2.25-2.25h16.5A2.25 2.25 0 0 1 22.5 6v12a2.25 2.25 0 0 1-2.25 2.25H3.75A2.25 2.25 0 0 1 1.5 18V6ZM3 16.06V18c0 .414.336.75.75.75h16.5A.75.75 0 0 0 21 18v-1.94l-2.69-2.689a1.5 1.5 0 0 0-2.12 0l-.88.879.97.97a.75.75 0 1 1-1.06 1.06l-5.16-5.159a1.5 1.5 0 0 0-2.12 0L3 16.061Zm10.125-7.81a1.125 1.125 0 1 1 2.25 0 1.125 1.125 0 0 1-2.25 0Z" clipRule="evenodd" />
                    </svg>
                    <input id="images" type="file" accept=".jpg,.gif,.mp4,.webm" className="hidden" onChange={handleFileChange} multiple />
                  </label>

                  <button
                    type="button"
                    title="Etiquetár amigos"
                    onClick={() => setAmigos(!amigos)}
                    className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors ${
                      amigos
                        ? "text-[color:var(--accent)] bg-[color:var(--accent)]/10"
                        : "text-[color:var(--text-secondary)] hover:text-[color:var(--accent)] hover:bg-white/5"
                    }`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                      <path d="M4.5 6.375a4.125 4.125 0 1 1 8.25 0 4.125 4.125 0 0 1-8.25 0ZM14.25 8.625a3.375 3.375 0 1 1 6.75 0 3.375 3.375 0 0 1-6.75 0ZM1.5 19.125a7.125 7.125 0 0 1 14.25 0v.003l-.001.119a.75.75 0 0 1-.363.63 13.067 13.067 0 0 1-6.761 1.873c-2.472 0-4.786-.684-6.76-1.873a.75.75 0 0 1-.364-.63l-.001-.122ZM17.25 19.128l-.001.144a2.25 2.25 0 0 1-.233.96 10.088 10.088 0 0 0 5.06-1.01.75.75 0 0 0 .42-.643 4.875 4.875 0 0 0-6.957-4.611 8.586 8.586 0 0 1 1.71 5.157v.003Z" />
                    </svg>
                  </button>

                  {/* Now Playing toggle */}
                  <button
                    type="button"
                    title="Now Playing"
                    onClick={() => setShowNowPlaying(!showNowPlaying)}
                    className={`h-9 px-3 flex items-center gap-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                      selectedTrack || showNowPlaying
                        ? "text-[color:var(--accent)] bg-[color:var(--accent)]/10"
                        : "text-[color:var(--text-secondary)] hover:text-[color:var(--accent)] hover:bg-white/5"
                    }`}
                  >
                    <span>🎵</span>
                    <span className="hidden sm:inline">{selectedTrack || "Now Playing"}</span>
                  </button>

                  {/* Era toggle */}
                  <button
                    type="button"
                    title="Tag de era"
                    onClick={() => setShowEraSelector(!showEraSelector)}
                    className={`h-9 px-3 flex items-center gap-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                      selectedEra
                        ? "bg-white/10 text-[color:var(--text-primary)]"
                        : showEraSelector
                        ? "text-[color:var(--accent)] bg-[color:var(--accent)]/10"
                        : "text-[color:var(--text-secondary)] hover:text-[color:var(--accent)] hover:bg-white/5"
                    }`}
                    style={selectedEra ? {
                      color: BTS_ERAS.find(e => e.key === selectedEra)?.color,
                      background: BTS_ERAS.find(e => e.key === selectedEra)?.bg,
                      border: `1px solid ${BTS_ERAS.find(e => e.key === selectedEra)?.color}`,
                    } : {}}
                  >
                    ✨
                    <span>{selectedEra ? BTS_ERAS.find(e => e.key === selectedEra)?.label : "Era"}</span>
                  </button>
                </div>

                <button
                  type="button"
                  className="btn-accent text-sm py-2 px-5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
                  onClick={handlePublish}
                  disabled={createPost.isPending || !content.trim()}
                >
                  {createPost.isPending ? "Publicando..." : "Publicar"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default PostForm;
