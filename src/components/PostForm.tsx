import { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import Avatar from "./Avatar";
import FriendSelector from "./FriendSearch";
import Link from "next/link";
import { useAuthStore } from "@/store/useAuthStore";
import { useFriends } from "@/hooks/useFriends";
import { useCreatePost, useUploadPhotos } from "@/hooks/usePosts";
import { BTS_ERAS } from "@/lib/bts-eras";
import { BTS_DISCOGRAPHY } from "@/lib/bts-discography";
import { BTS_MEMBERS, getMemberByKey } from "@/lib/bts-members";
import PollBuilder, { type PollDraft } from "@/components/PollBuilder";
import type { Profile, TaggedFriend } from "@/types";

interface PostFormProps {
  profile: Profile | null;
}

const PostForm = ({ profile }: PostFormProps) => {
  const { user } = useAuthStore();
  const { data: friends = [] } = useFriends(user);
  const createPost = useCreatePost();
  const uploadPhotos = useUploadPhotos();

  type ActiveSection = "friends" | "nowplaying" | "members" | "era" | "poll" | null;

  const [showModal, setShowModal] = useState(false);
  const [content, setContent] = useState("");
  const [uploads, setUploads] = useState<{ file: File; preview: string }[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<TaggedFriend[]>([]);
  const [selectedEra, setSelectedEra] = useState<string | null>(null);
  const [selectedAlbum, setSelectedAlbum] = useState("");
  const [selectedTrack, setSelectedTrack] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [activeSection, setActiveSection] = useState<ActiveSection>(null);
  const [poll, setPoll] = useState<PollDraft | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [sourceDomain, setSourceDomain] = useState<string | null>(null);
  const [sourceLabel, setSourceLabel] = useState<string | null>(null);
  const [unfurling, setUnfurling] = useState(false);
  const nowPlaying = selectedAlbum && selectedTrack ? `${selectedTrack} — ${BTS_DISCOGRAPHY.find(a => a.key === selectedAlbum)?.title}` : "";

  function toggleSection(section: ActiveSection) {
    setActiveSection((prev) => (prev === section ? null : section));
  }

  const isPublishing = createPost.isPending || uploadPhotos.isPending;
  const modalRef = useFocusTrap<HTMLDivElement>(showModal);

  function handleFileChange(ev: React.ChangeEvent<HTMLInputElement>) {
    if (!ev.target.files?.length) return;
    const files = Array.from(ev.target.files);
    setUploads((prev) => [...prev, ...files.map((f) => ({ file: f, preview: URL.createObjectURL(f) }))]);
    // Reset input so same file can be re-selected
    ev.target.value = "";
  }

  function removeUpload(index: number) {
    setUploads((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  }

  function resetModal() {
    uploads.forEach((u) => URL.revokeObjectURL(u.preview));
    setShowModal(false);
    setContent("");
    setUploads([]);
    setSelectedFriends([]);
    setSelectedEra(null);
    setSelectedAlbum("");
    setSelectedTrack("");
    setSelectedMembers([]);
    setActiveSection(null);
    setPoll(null);
    setSourceUrl(null);
    setSourceDomain(null);
    setSourceLabel(null);
  }

  async function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const text = e.clipboardData.getData("text");
    const match = text.match(/https?:\/\/[^\s]+/);
    if (!match) return;

    const pasted = match[0];
    const isOnlyUrl = text.trim() === pasted.trim();

    // Si el paste es solo una URL, evitamos que se inserte en el textarea —
    // la reemplazaremos con la descripción extraída
    if (isOnlyUrl) e.preventDefault();

    setUnfurling(true);
    try {
      const res = await fetch(`/api/unfurl?url=${encodeURIComponent(pasted)}`);
      if (!res.ok) {
        if (res.status === 422) {
          toast.error("Este contenido es privado o no está disponible para compartir.");
        }
        // Si el paste era solo URL y falló, lo insertamos igual para no perderlo
        if (isOnlyUrl) setContent((prev) => prev ? `${prev}\n${pasted}` : pasted);
        return;
      }
      const data = await res.json() as {
        description: string;
        imageBase64: string | null;
        imageType: string | null;
        domain: string;
        source_url: string;
        source_label: string | null;
      };

      // Si era solo URL, reemplazamos con la descripción; si venía con texto, no tocamos el content
      if (isOnlyUrl && data.description) {
        setContent(data.description);
      }

      setSourceUrl(data.source_url);
      setSourceDomain(data.domain);
      setSourceLabel(data.source_label);

      // Convert base64 image to File and add to uploads
      if (data.imageBase64 && data.imageType) {
        const byteStr = atob(data.imageBase64);
        const arr = new Uint8Array(byteStr.length);
        for (let i = 0; i < byteStr.length; i++) arr[i] = byteStr.charCodeAt(i);
        const blob = new Blob([arr], { type: data.imageType });
        const ext = data.imageType.split("/")[1] ?? "jpg";
        const file = new File([blob], `shared.${ext}`, { type: data.imageType });
        const preview = URL.createObjectURL(blob);
        setUploads((prev) => [...prev, { file, preview }]);
      }
    } catch {
      if (isOnlyUrl) setContent((prev) => prev ? `${prev}\n${pasted}` : pasted);
    } finally {
      setUnfurling(false);
    }
  }

  async function handlePublish() {
    if (!user) return;
    const uploadedPhotos = uploads.length > 0
      ? await uploadPhotos.mutateAsync(uploads.map((u) => u.file))
      : [];
    await createPost.mutateAsync({
      userId: user, content, uploads: uploadedPhotos, selectedFriends, friends,
      era: selectedEra,
      nowPlaying: nowPlaying.trim() || null,
      btsMembers: selectedMembers,
      poll: poll
        ? {
            question: poll.question,
            options: poll.options,
            ends_at: new Date(Date.now() + poll.duration * 86_400_000).toISOString(),
          }
        : null,
      sourceUrl,
      sourceLabel,
    });
    resetModal();
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
            onClick={(e) => { if (e.target === e.currentTarget) resetModal(); }}
          >
            <motion.div
              ref={modalRef}
              key="modal-panel"
              role="dialog"
              aria-modal="true"
              aria-label="Crear publicación"
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
                  onClick={resetModal}
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
              <label htmlFor="post-content" className="sr-only">Contenido del post</label>
              <div className="relative">
                <textarea
                  id="post-content"
                  rows={5}
                  className="army-input w-full px-4 py-3 text-sm resize-none rounded-xl"
                  placeholder="¿En qué estás pensando? Podés pegar un link para compartir contenido."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  onPaste={handlePaste}
                  aria-required="true"
                />
                {unfurling && (
                  <div className="absolute inset-0 rounded-xl flex items-center justify-center gap-2 text-xs text-[color:var(--text-muted)]"
                    style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(2px)" }}>
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                        <path fillRule="evenodd" d="M4.755 10.059a7.5 7.5 0 0 1 12.548-3.364l1.903 1.903h-3.183a.75.75 0 1 0 0 1.5h4.992a.75.75 0 0 0 .75-.75V4.356a.75.75 0 0 0-1.5 0v3.18l-1.9-1.9A9 9 0 0 0 3.306 9.67a.75.75 0 1 0 1.45.388Zm15.408 3.352a.75.75 0 0 0-.919.53 7.5 7.5 0 0 1-12.548 3.364l-1.902-1.903h3.183a.75.75 0 0 0 0-1.5H2.984a.75.75 0 0 0-.75.75v4.992a.75.75 0 0 0 1.5 0v-3.18l1.9 1.9a9 9 0 0 0 15.059-4.035.75.75 0 0 0-.53-.918Z" clipRule="evenodd" />
                      </svg>
                    </motion.div>
                    Obteniendo contenido...
                  </div>
                )}
              </div>

              {/* Source attribution badge */}
              {sourceUrl && sourceDomain && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-between px-3 py-2 rounded-lg mt-1"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 text-[color:var(--accent)] shrink-0">
                      <path fillRule="evenodd" d="M19.902 4.098a3.75 3.75 0 0 0-5.304 0l-4.5 4.5a3.75 3.75 0 0 0 1.035 6.037.75.75 0 0 1-.646 1.353 5.25 5.25 0 0 1-1.449-8.45l4.5-4.5a5.25 5.25 0 1 1 7.424 7.424l-1.757 1.757a.75.75 0 1 1-1.06-1.06l1.757-1.757a3.75 3.75 0 0 0 0-5.304Zm-7.389 4.267a.75.75 0 0 1 1-.353 5.25 5.25 0 0 1 1.449 8.45l-4.5 4.5a5.25 5.25 0 1 1-7.424-7.424l1.757-1.757a.75.75 0 1 1 1.06 1.06l-1.757 1.757a3.75 3.75 0 1 0 5.304 5.304l4.5-4.5a3.75 3.75 0 0 0-.477-5.794.75.75 0 0 1-.354-1Z" clipRule="evenodd" />
                    </svg>
                    <span className="text-xs text-[color:var(--text-muted)] truncate">
                      Vía {sourceLabel ? `${sourceLabel} · ${sourceDomain}` : sourceDomain}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setSourceUrl(null); setSourceDomain(null); }}
                    className="text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)] text-xs ml-2 shrink-0"
                  >✕</button>
                </motion.div>
              )}

              {/* Media preview */}
              {uploads.length > 0 && (
                <div
                  className={`mt-3 grid gap-2 ${
                    uploads.length === 1
                      ? "grid-cols-1"
                      : uploads.length === 2
                      ? "grid-cols-2"
                      : "grid-cols-3"
                  }`}
                >
                  {uploads.map((upload, i) => (
                    <div key={i} className="relative group rounded-xl overflow-hidden aspect-square">
                      {upload.file.type.startsWith("image/") ? (
                        <img src={upload.preview} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <video className="w-full h-full object-cover">
                          <source src={upload.preview} />
                        </video>
                      )}
                      {/* Remove button */}
                      <button
                        type="button"
                        onClick={() => removeUpload(i)}
                        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ background: "rgba(0,0,0,0.6)" }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 text-white">
                          <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Tagged friends */}
              {activeSection === "friends" && (
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
                {activeSection === "nowplaying" && (
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

                      {/* Album select con cover preview */}
                      <div className="flex items-center gap-2">
                        {selectedAlbum && (
                          <Image
                            src={BTS_DISCOGRAPHY.find(a => a.key === selectedAlbum)?.cover ?? ""}
                            alt=""
                            width={40}
                            height={40}
                            className="w-10 h-10 rounded-lg object-cover shrink-0"
                            sizes="40px"
                          />
                        )}
                        <select
                          value={selectedAlbum}
                          onChange={(e) => { setSelectedAlbum(e.target.value); setSelectedTrack(""); }}
                          className="army-input flex-1 px-3 py-2 text-sm rounded-lg appearance-none cursor-pointer"
                        >
                          <option value="">Álbum...</option>
                          {BTS_DISCOGRAPHY.map((album) => (
                            <option key={album.key} value={album.key}>
                              {album.title} ({album.year})
                            </option>
                          ))}
                        </select>
                      </div>

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
                {activeSection === "era" && (
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

              {/* BTS Member selector */}
              <AnimatePresence>
                {activeSection === "members" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-3 overflow-hidden"
                  >
                    <div
                      className="px-3 py-3 rounded-xl"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                    >
                      <p className="text-[10px] tracking-widest text-[color:var(--text-muted)] uppercase mb-3">
                        Etiquetar miembro
                      </p>
                      <div className="flex gap-3 flex-wrap">
                        {BTS_MEMBERS.map((member) => {
                          const isSelected = selectedMembers.includes(member.key);
                          return (
                            <motion.button
                              key={member.key}
                              type="button"
                              whileTap={{ scale: 0.92 }}
                              onClick={() => setSelectedMembers((prev) =>
                                isSelected ? prev.filter((k) => k !== member.key) : [...prev, member.key]
                              )}
                              className="flex flex-col items-center gap-1"
                            >
                              <div
                                className="w-11 h-11 rounded-full overflow-hidden transition-all duration-200"
                                style={{
                                  outline: isSelected ? `2px solid ${member.color}` : "2px solid transparent",
                                  outlineOffset: "2px",
                                  boxShadow: isSelected ? `0 0 10px ${member.color}60` : "none",
                                }}
                              >
                                <Image src={member.photo} alt={member.name} width={44} height={44} className="w-full h-full object-cover object-top" sizes="44px" />
                              </div>
                              <span className="text-[10px]" style={{ color: isSelected ? member.color : "var(--text-muted)" }}>
                                {member.name}
                              </span>
                            </motion.button>
                          );
                        })}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Poll builder */}
              <AnimatePresence>
                {activeSection === "poll" && poll && (
                  <motion.div
                    key="poll"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <PollBuilder value={poll} onChange={setPoll} />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Actions bar */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/10 gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 flex-wrap">
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

                  {/* Friends toggle */}
                  <button
                    type="button"
                    title="Etiquetar amigos"
                    onClick={() => toggleSection("friends")}
                    className={`h-9 px-3 flex items-center gap-1.5 rounded-lg text-xs font-medium transition-all duration-200 border ${
                      activeSection === "friends" || selectedFriends.length > 0
                        ? "text-[color:var(--accent)] bg-[color:var(--accent)]/10 border-[color:var(--accent)]/30"
                        : "text-[color:var(--text-primary)] bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
                    }`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 shrink-0">
                      <path d="M4.5 6.375a4.125 4.125 0 1 1 8.25 0 4.125 4.125 0 0 1-8.25 0ZM14.25 8.625a3.375 3.375 0 1 1 6.75 0 3.375 3.375 0 0 1-6.75 0ZM1.5 19.125a7.125 7.125 0 0 1 14.25 0v.003l-.001.119a.75.75 0 0 1-.363.63 13.067 13.067 0 0 1-6.761 1.873c-2.472 0-4.786-.684-6.76-1.873a.75.75 0 0 1-.364-.63l-.001-.122ZM17.25 19.128l-.001.144a2.25 2.25 0 0 1-.233.96 10.088 10.088 0 0 0 5.06-1.01.75.75 0 0 0 .42-.643 4.875 4.875 0 0 0-6.957-4.611 8.586 8.586 0 0 1 1.71 5.157v.003Z" />
                    </svg>
                    <span className="hidden sm:inline">
                      {selectedFriends.length > 0 ? `${selectedFriends.length} amigo${selectedFriends.length > 1 ? "s" : ""}` : "Amigos"}
                    </span>
                  </button>

                  {/* Now Playing toggle */}
                  <button
                    type="button"
                    title="Now Playing"
                    onClick={() => toggleSection("nowplaying")}
                    className={`h-9 px-3 flex items-center gap-1.5 rounded-lg text-xs font-medium transition-all duration-200 border ${
                      activeSection === "nowplaying" || selectedTrack
                        ? "text-[color:var(--accent)] bg-[color:var(--accent)]/10 border-[color:var(--accent)]/30"
                        : "text-[color:var(--text-primary)] bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
                    }`}
                  >
                    <span>🎵</span>
                    <span className="hidden sm:inline">{selectedTrack || "Now Playing"}</span>
                  </button>

                  {/* Members toggle */}
                  <button
                    type="button"
                    title="Etiquetar miembro BTS"
                    onClick={() => toggleSection("members")}
                    className={`h-9 px-3 flex items-center gap-1.5 rounded-lg text-xs font-medium transition-all duration-200 border ${
                      activeSection === "members" || selectedMembers.length > 0
                        ? "text-[color:var(--accent)] bg-[color:var(--accent)]/10 border-[color:var(--accent)]/30"
                        : "text-[color:var(--text-primary)] bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
                    }`}
                  >
                    {selectedMembers.length > 0 ? (
                      <div className="flex -space-x-1.5">
                        {selectedMembers.slice(0, 3).map((key) => {
                          const m = getMemberByKey(key);
                          return m ? (
                            <Image key={key} src={m.photo} alt={m.name} width={20} height={20} className="w-5 h-5 rounded-full object-cover object-top ring-1 ring-[var(--bg-surface)]" sizes="20px" />
                          ) : null;
                        })}
                      </div>
                    ) : (
                      <span>💜</span>
                    )}
                    <span className="hidden sm:inline">
                      {selectedMembers.length > 0 ? `${selectedMembers.length} miembro${selectedMembers.length > 1 ? "s" : ""}` : "Miembros"}
                    </span>
                  </button>

                  {/* Poll toggle */}
                  <button
                    type="button"
                    title="Agregar encuesta"
                    onClick={() => {
                      if (activeSection === "poll") {
                        setActiveSection(null);
                        setPoll(null);
                      } else {
                        setActiveSection("poll");
                        setPoll((p) => p ?? { question: "", options: ["", ""], duration: 1 });
                      }
                    }}
                    className={`h-9 px-3 flex items-center gap-1.5 rounded-lg text-xs font-medium transition-all duration-200 border ${
                      activeSection === "poll"
                        ? "text-[color:var(--accent)] bg-[color:var(--accent)]/10 border-[color:var(--accent)]/30"
                        : "text-[color:var(--text-primary)] bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
                    }`}
                  >
                    <span>📊</span>
                    <span>{poll ? "Encuesta activa" : "Encuesta"}</span>
                  </button>

                  {/* Era toggle */}
                  <button
                    type="button"
                    title="Tag de era"
                    onClick={() => toggleSection("era")}
                    className={`h-9 px-3 flex items-center gap-1.5 rounded-lg text-xs font-medium transition-all duration-200 border ${
                      activeSection === "era"
                        ? "text-[color:var(--accent)] bg-[color:var(--accent)]/10 border-[color:var(--accent)]/30"
                        : "text-[color:var(--text-primary)] bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
                    }`}
                    style={selectedEra ? {
                      color: BTS_ERAS.find(e => e.key === selectedEra)?.color,
                      background: BTS_ERAS.find(e => e.key === selectedEra)?.bg + "33",
                      borderColor: BTS_ERAS.find(e => e.key === selectedEra)?.color + "60",
                    } : {}}
                  >
                    <span>✨</span>
                    <span>{selectedEra ? BTS_ERAS.find(e => e.key === selectedEra)?.label : "Era"}</span>
                  </button>
                </div>

                <button
                  type="button"
                  className="btn-accent text-sm py-2 px-5 ml-auto disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
                  onClick={handlePublish}
                  disabled={isPublishing || !content.trim()}
                >
                  {isPublishing ? "Publicando..." : "Publicar"}
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
