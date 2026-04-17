"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import Avatar from "@/components/Avatar";
import ArmySinceBadge from "@/components/ArmySinceBadge";
import BtsMemberSelector from "@/components/BtsMemberSelector";
import PostsCard from "@/components/PostsCard";
import Lightbox from "@/components/Lightbox";
import { BTS_DISCOGRAPHY, getAlbumByKey } from "@/lib/bts-discography";
import { supabase } from "@/lib/supabase/browser";
import { useAuthStore } from "@/store/useAuthStore";
import Link from "next/link";
import FriendButton from "@/components/FriendButton";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useRouter, useSearchParams } from "next/navigation";
import type { Profile, Photo, TaggedFriend } from "@/types";

interface ProfileViewProps {
  profile: Profile;
  posts: ({ id: string; content: string; created_at: string; author: string; photos: Photo[] | null; tagged: unknown[] | null; era?: string | null; now_playing?: string | null; bts_members?: string[] | null; profiles?: { id: string; name: string; avatar: string } | { id: string; name: string; avatar: string }[] })[];
  friends: { id: string; name: string; avatar: string }[];
  photos: { photos: Photo[] | null }[];
  currentUserId: string | null;
  initialTab: string;
}

const BASE_TABS = [
  { key: "about",   label: "Info" },
  { key: "posts",   label: "Posteos" },
  { key: "photos",  label: "Fotos" },
];
const OWN_TABS = [...BASE_TABS, { key: "account", label: "Cuenta" }];

export default function ProfileView({
  profile,
  posts: initialPosts,
  friends: initialFriends,
  photos: initialPhotos,
  currentUserId,
  initialTab,
}: ProfileViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") ?? initialTab;

  const [activeTab, setActiveTab] = useState(tab);
  const [editing, setEditing] = useState(false);

  // Account / password change
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [about, setAbout] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [profileUrl, setProfileUrl] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<{ file: File; url: string } | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [photoLightboxIndex, setPhotoLightboxIndex] = useState<number | null>(null);
  const avatarModalRef = useFocusTrap<HTMLDivElement>(!!avatarPreview);

  const allPhotos: Photo[] = initialPhotos.flatMap((el) => el.photos ?? []);
  const [bias, setBias] = useState<string | null>(profile.bias ?? null);
  const [biasWrecker, setBiasWrecker] = useState<string | null>(profile.bias_wrecker ?? null);
  const [favAlbum, setFavAlbum] = useState<string>(profile.fav_album ?? "");
  const [favSong, setFavSong] = useState<string>(profile.fav_song ?? "");

  const { user, session } = useAuthStore();
  const queryClient = useQueryClient();

  const isOwn = profile.id === currentUserId;
  const tabs = isOwn ? OWN_TABS : BASE_TABS;


  useEffect(() => { setActiveTab(tab); }, [tab]);

  useEffect(() => {
    if (profile.cover)  setCoverUrl(profile.cover);
    if (profile.avatar) setProfileUrl(profile.avatar);
  }, [profile]);

  function handleTabChange(newTab: string) {
    setActiveTab(newTab);
    router.push(`/profile/${profile.id}?tab=${newTab}`);
  }

  async function handleCoverUpload(event: React.ChangeEvent<HTMLInputElement>) {
    if (!currentUserId || !event.target.files?.[0]) return;
    const file = event.target.files[0];
    const fileName = `${currentUserId}/cover.${file.name.split(".").pop()}`;
    const { error } = await supabase.storage.from("covers").upload(fileName, file, {
      upsert: true,
      contentType: file.type || "image/jpeg",
    });
    if (error) return;
    const { data: urlData } = supabase.storage.from("covers").getPublicUrl(fileName);
    setCoverUrl(urlData.publicUrl);
    await supabase.from("profiles").update({ cover: urlData.publicUrl }).eq("id", currentUserId);
    queryClient.invalidateQueries({ queryKey: ["profile", currentUserId] });
  }

  function handleProfileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    if (!currentUserId || !event.target.files?.[0]) return;
    const file = event.target.files[0];
    setAvatarPreview({ file, url: URL.createObjectURL(file) });
    event.target.value = "";
  }

  async function confirmAvatarUpload() {
    if (!currentUserId || !avatarPreview) return;
    setAvatarUploading(true);
    const { compressImage } = await import("@/lib/compressImage");
    const compressed = await compressImage(avatarPreview.file, 400, 0.88);
    const fileName = `${currentUserId}/profile.jpg`;
    const { error } = await supabase.storage.from("avatars").upload(fileName, compressed, {
      upsert: true,
      contentType: "image/jpeg",
    });
    if (!error) {
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(fileName);
      setProfileUrl(urlData.publicUrl);
      await supabase.from("profiles").update({ avatar: urlData.publicUrl }).eq("id", currentUserId);
      queryClient.invalidateQueries({ queryKey: ["profile", currentUserId] });
    }
    URL.revokeObjectURL(avatarPreview.url);
    setAvatarPreview(null);
    setAvatarUploading(false);
  }

  function cancelAvatarUpload() {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview.url);
    setAvatarPreview(null);
  }

  async function handleSaveAbout() {
    await supabase.from("profiles").update({
      about,
      bias,
      bias_wrecker: biasWrecker,
      fav_album: favAlbum || null,
      fav_song: favSong || null,
    }).eq("id", profile.id);
    queryClient.invalidateQueries({ queryKey: ["profile", profile.id] });
    setEditing(false);
  }

  async function handleChangePassword() {
    setPasswordError(null);
    setPasswordSuccess(false);
    if (newPassword.length < 6) {
      setPasswordError("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Las contraseñas no coinciden");
      return;
    }
    setPasswordLoading(true);
    const email = session?.user?.email ?? "";
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
    if (signInError) {
      setPasswordError("La contraseña actual es incorrecta");
      setPasswordLoading(false);
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordLoading(false);
    if (error) {
      setPasswordError(error.message);
    } else {
      setPasswordSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
  }

  return (
    <div className="glass-card overflow-hidden mb-5">
      {/* Cover */}
      <div
        className="relative h-44 md:h-56 bg-cover bg-center"
        style={{
          backgroundImage: coverUrl
            ? `url(${coverUrl})`
            : "linear-gradient(135deg, var(--aurora-4), var(--aurora-2))",
        }}
      >
        {/* Gradient overlay */}
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent 40%, var(--bg-surface) 100%)" }} />

        {isOwn && (
          <label
            htmlFor="cover"
            aria-label="Cambiar foto de portada"
            className="absolute top-3 right-3 cursor-pointer w-8 h-8 flex items-center justify-center rounded-lg bg-black/40 hover:bg-black/60 text-white transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" aria-hidden="true" focusable="false">
              <path d="M21.731 2.269a2.625 2.625 0 0 0-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 0 0 0-3.712ZM19.513 8.199l-3.712-3.712-8.4 8.4a5.25 5.25 0 0 0-1.32 2.214l-.8 2.685a.75.75 0 0 0 .933.933l2.685-.8a5.25 5.25 0 0 0 2.214-1.32l8.4-8.4Z" />
              <path d="M5.25 5.25a3 3 0 0 0-3 3v10.5a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3V13.5a.75.75 0 0 0-1.5 0v5.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5V8.25a1.5 1.5 0 0 1 1.5-1.5h5.25a.75.75 0 0 0 0-1.5H5.25Z" />
            </svg>
            <input type="file" id="cover" className="hidden" accept="image/*" onChange={handleCoverUpload} />
          </label>
        )}

        {/* Avatar — overlapping the cover bottom */}
        <div className="absolute -bottom-10 left-6">
          <div className="relative">
            <Avatar url={profileUrl || null} size="lg" ring />
            {isOwn && (
              <label
                htmlFor="avatar"
                aria-label="Cambiar foto de perfil"
                className="absolute bottom-0 right-0 w-7 h-7 flex items-center justify-center rounded-full bg-[var(--accent)] cursor-pointer hover:bg-[var(--accent-hover)] transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 text-white" aria-hidden="true" focusable="false">
                  <path d="M21.731 2.269a2.625 2.625 0 0 0-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 0 0 0-3.712ZM19.513 8.199l-3.712-3.712-8.4 8.4a5.25 5.25 0 0 0-1.32 2.214l-.8 2.685a.75.75 0 0 0 .933.933l2.685-.8a5.25 5.25 0 0 0 2.214-1.32l8.4-8.4Z" />
                </svg>
                <input type="file" id="avatar" className="hidden" accept="image/*" onChange={handleProfileUpload} />
              </label>
            )}
          </div>
        </div>
      </div>

      {/* Profile info */}
      <div className="pt-14 px-6 pb-4 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-[color:var(--text-primary)]">{profile.name}</h1>
          {profile.about && (
            <p className="text-sm text-[color:var(--text-secondary)] mt-0.5">{profile.about}</p>
          )}
          <ArmySinceBadge
            armySince={profile.army_since}
            isOwn={isOwn}
            profileId={profile.id}
            onUpdate={() => queryClient.invalidateQueries({ queryKey: ["profile", profile.id] })}
          />
        </div>

        {!isOwn && <FriendButton targetId={profile.id} />}
      </div>

      {/* Tabs */}
      <div role="tablist" aria-label="Secciones del perfil" className="flex border-t border-white/5 px-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={activeTab === t.key}
            aria-controls={`tab-panel-${t.key}`}
            onClick={() => handleTabChange(t.key)}
            className={`relative px-4 py-3 text-sm font-medium transition-colors duration-200 ${
              activeTab === t.key
                ? "text-[color:var(--text-primary)]"
                : "text-[color:var(--text-muted)] hover:text-[color:var(--text-secondary)]"
            }`}
          >
            {t.label}
            {activeTab === t.key && (
              <motion.div
                layoutId="profile-tab-indicator"
                className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full"
                style={{ background: "var(--accent)" }}
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="px-6 py-5">

        {/* About */}
        {activeTab === "about" && (
          <div className="flex flex-col gap-6">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <h2 className="text-sm font-semibold text-[color:var(--text-secondary)] uppercase tracking-wider mb-3">Sobre mí</h2>
                {editing ? (
                  <input
                    type="text"
                    value={about}
                    onChange={(ev) => setAbout(ev.target.value)}
                    className="army-input w-full px-4 py-2.5 text-sm"
                    autoFocus
                  />
                ) : (
                  <p className="text-[color:var(--text-primary)] text-sm leading-relaxed">
                    {profile.about || <span className="text-[color:var(--text-muted)] italic">Sin descripción</span>}
                  </p>
                )}
              </div>

              {isOwn && !editing && (
                <button
                  type="button"
                  onClick={() => { setEditing(true); setAbout(profile.about ?? ""); }}
                  className="mt-1 shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)] hover:bg-white/10 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                    <path d="M21.731 2.269a2.625 2.625 0 0 0-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 0 0 0-3.712ZM19.513 8.199l-3.712-3.712-8.4 8.4a5.25 5.25 0 0 0-1.32 2.214l-.8 2.685a.75.75 0 0 0 .933.933l2.685-.8a5.25 5.25 0 0 0 2.214-1.32l8.4-8.4Z" />
                  </svg>
                  Editar
                </button>
              )}
            </div>
            {/* Guardar / Cancelar — solo en modo edición */}
            {isOwn && editing && (
              <div className="flex gap-3 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={handleSaveAbout}
                  className="btn-accent flex-1 py-2.5 text-sm flex items-center justify-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                    <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 0 1 .208 1.04l-9 13.5a.75.75 0 0 1-1.154.114l-6-6a.75.75 0 0 1 1.06-1.06l5.353 5.353 8.493-12.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
                  </svg>
                  Guardar cambios
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="px-5 py-2.5 text-sm rounded-xl text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)] hover:bg-white/10 transition-colors font-medium"
                >
                  Cancelar
                </button>
              </div>
            )}

            {/* BTS fields */}
            <div className="flex flex-col gap-5">
              <h2 className="text-sm font-semibold text-[color:var(--text-secondary)] uppercase tracking-wider">BTS</h2>

              {/* Bias */}
              {editing ? (
                <BtsMemberSelector value={bias} onChange={setBias} label="Bias" />
              ) : bias ? (
                <BtsMemberSelector value={bias} onChange={() => {}} label="Bias" readOnly />
              ) : isOwn ? (
                <p className="text-[color:var(--text-muted)] text-sm italic">Sin bias definido</p>
              ) : null}

              {/* Bias wrecker */}
              {editing ? (
                <BtsMemberSelector value={biasWrecker} onChange={setBiasWrecker} label="Bias Wrecker" />
              ) : biasWrecker ? (
                <BtsMemberSelector value={biasWrecker} onChange={() => {}} label="Bias Wrecker" readOnly />
              ) : null}

              {/* Álbum favorito */}
              {editing ? (
                <div>
                  <p className="text-[10px] text-[color:var(--text-muted)] uppercase tracking-wider mb-2">Álbum favorito</p>
                  <div className="flex items-center gap-2">
                    {favAlbum && (
                      <Image
                        src={getAlbumByKey(favAlbum)?.cover ?? ""}
                        alt=""
                        width={40}
                        height={40}
                        className="w-10 h-10 rounded-lg object-cover shrink-0"
                        sizes="40px"
                      />
                    )}
                    <select
                      value={favAlbum}
                      onChange={(e) => { setFavAlbum(e.target.value); setFavSong(""); }}
                      className="army-input flex-1 px-3 py-2 text-sm rounded-lg appearance-none cursor-pointer"
                    >
                      <option value="">Elegir álbum...</option>
                      {BTS_DISCOGRAPHY.map((album) => (
                        <option key={album.key} value={album.key}>{album.title} ({album.year})</option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : favAlbum ? (
                <div className="flex items-center gap-3">
                  <Image
                    src={getAlbumByKey(favAlbum)?.cover ?? ""}
                    alt=""
                    width={48}
                    height={48}
                    className="w-12 h-12 rounded-lg object-cover shrink-0"
                    style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.4)" }}
                    sizes="48px"
                  />
                  <div>
                    <p className="text-[10px] text-[color:var(--text-muted)] uppercase tracking-wider">Álbum favorito</p>
                    <p className="text-sm font-semibold text-[color:var(--text-primary)]">{getAlbumByKey(favAlbum)?.title}</p>
                    <p className="text-xs text-[color:var(--text-muted)]">{getAlbumByKey(favAlbum)?.year}</p>
                  </div>
                </div>
              ) : null}

              {/* Canción favorita */}
              {editing ? (
                <div>
                  <p className="text-[10px] text-[color:var(--text-muted)] uppercase tracking-wider mb-2">Canción favorita</p>
                  <div className="flex items-center gap-2">
                    {favAlbum && (
                      <Image
                        src={getAlbumByKey(favAlbum)?.cover ?? ""}
                        alt=""
                        width={40}
                        height={40}
                        className="w-10 h-10 rounded-lg object-cover shrink-0 opacity-60"
                        sizes="40px"
                      />
                    )}
                    <select
                      value={favSong}
                      onChange={(e) => setFavSong(e.target.value)}
                      disabled={!favAlbum}
                      className="army-input flex-1 px-3 py-2 text-sm rounded-lg appearance-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <option value="">{favAlbum ? "Elegir canción..." : "Primero elegí un álbum"}</option>
                      {getAlbumByKey(favAlbum)?.tracks.map((track) => (
                        <option key={track} value={track}>{track}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : favSong ? (
                <div className="flex items-center gap-3">
                  {favAlbum && (
                    <Image
                      src={getAlbumByKey(favAlbum)?.cover ?? ""}
                      alt=""
                      width={40}
                      height={40}
                      className="w-10 h-10 rounded-lg object-cover shrink-0 opacity-80"
                      sizes="40px"
                    />
                  )}
                  <div>
                    <p className="text-[10px] text-[color:var(--text-muted)] uppercase tracking-wider">Canción favorita</p>
                    <p className="text-sm font-semibold text-[color:var(--text-primary)]">{profile.fav_song}</p>
                    {favAlbum && <p className="text-xs text-[color:var(--text-muted)]">{getAlbumByKey(favAlbum)?.title}</p>}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* Posts */}
        {activeTab === "posts" && (
          <div>
            {initialPosts.length === 0 ? (
              <p className="text-[color:var(--text-muted)] text-sm text-center py-8">Sin publicaciones aún</p>
            ) : (
              initialPosts.map((post) => {
                const authorProfile = Array.isArray(post.profiles)
                  ? (post.profiles[0] ?? { id: post.author, name: "Unknown", avatar: "" })
                  : (post.profiles ?? { id: post.author, name: "Unknown", avatar: "" });
                const tagged = post.tagged as TaggedFriend[] | null;
                return (
                  <PostsCard
                    key={post.id}
                    id={post.id}
                    content={post.content}
                    created_at={post.created_at}
                    photos={post.photos}
                    tagged={tagged}
                    era={post.era}
                    now_playing={post.now_playing}
                    bts_members={post.bts_members}
                    profiles={authorProfile}
                  />
                );
              })
            )}
          </div>
        )}

        {/* Account */}
        {activeTab === "account" && isOwn && (
          <div className="flex flex-col gap-3 max-w-md">
            {/* Info */}
            <div className="flex flex-col gap-1.5 p-4 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <p className="text-[10px] text-[color:var(--text-muted)] uppercase tracking-wider mb-1">Información de cuenta</p>
              <div>
                <p className="text-[10px] text-[color:var(--text-muted)] uppercase tracking-wider mb-1">Nombre</p>
                <div className="army-input px-4 py-2.5 text-sm text-[color:var(--text-primary)] rounded-xl">
                  {profile.name}
                </div>
              </div>
              <div>
                <p className="text-[10px] text-[color:var(--text-muted)] uppercase tracking-wider mb-1">Correo electrónico</p>
                <div className="army-input px-4 py-2.5 text-sm text-[color:var(--text-primary)] rounded-xl">
                  {session?.user?.email ?? "—"}
                </div>
              </div>
            </div>

            {/* Change password */}
            <div className="flex flex-col gap-3 p-4 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <p className="text-[10px] text-[color:var(--text-muted)] uppercase tracking-wider">Cambiar contraseña</p>
              <input
                type="password"
                placeholder="Contraseña actual"
                value={currentPassword}
                onChange={(e) => { setCurrentPassword(e.target.value); setPasswordError(null); setPasswordSuccess(false); }}
                className="army-input w-full px-4 py-2.5 text-sm"
              />
              <input
                type="password"
                placeholder="Nueva contraseña"
                value={newPassword}
                onChange={(e) => { setNewPassword(e.target.value); setPasswordError(null); setPasswordSuccess(false); }}
                className="army-input w-full px-4 py-2.5 text-sm"
              />
              <input
                type="password"
                placeholder="Confirmar nueva contraseña"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setPasswordError(null); setPasswordSuccess(false); }}
                className="army-input w-full px-4 py-2.5 text-sm"
              />

              <AnimatePresence mode="wait">
                {passwordError && (
                  <motion.p key="err" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-red-400 text-sm px-1">
                    {passwordError}
                  </motion.p>
                )}
                {passwordSuccess && (
                  <motion.p key="ok" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-emerald-400 text-sm px-1">
                    Contraseña actualizada correctamente
                  </motion.p>
                )}
              </AnimatePresence>

              <button
                type="button"
                onClick={handleChangePassword}
                disabled={passwordLoading || !currentPassword || !newPassword || !confirmPassword}
                className="btn-accent w-full py-2.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {passwordLoading ? "Actualizando..." : "Actualizar contraseña"}
              </button>
            </div>
          </div>
        )}

        {/* Photos */}
        {activeTab === "photos" && (
          <div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {allPhotos.length === 0 ? (
                <p className="text-[color:var(--text-muted)] text-sm col-span-full text-center py-8">Sin fotos aún</p>
              ) : (
                allPhotos.map((img, idx) => (
                  <button
                    key={img.id ?? idx}
                    type="button"
                    className="relative rounded-xl overflow-hidden aspect-square hover:opacity-80 cursor-zoom-in transition-opacity focus:outline-none"
                    onClick={() => setPhotoLightboxIndex(idx)}
                  >
                    <Image src={img.url} alt="" fill className="object-cover" sizes="(max-width: 768px) 50vw, 33vw" />
                  </button>
                ))
              )}
            </div>
          </div>
        )}

      </div>

      {/* Profile photos lightbox */}
      <AnimatePresence>
        {photoLightboxIndex !== null && allPhotos.length > 0 && (
          <Lightbox
            photos={allPhotos}
            index={photoLightboxIndex}
            onClose={() => setPhotoLightboxIndex(null)}
            onPrev={() => setPhotoLightboxIndex((i) => (i! - 1 + allPhotos.length) % allPhotos.length)}
            onNext={() => setPhotoLightboxIndex((i) => (i! + 1) % allPhotos.length)}
          />
        )}
      </AnimatePresence>

      {/* Avatar crop preview modal */}
      <AnimatePresence>
        {avatarPreview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
            style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}
          >
            <motion.div
              ref={avatarModalRef}
              role="dialog"
              aria-modal="true"
              aria-label="Vista previa del avatar"
              initial={{ opacity: 0, scale: 0.92, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92 }}
              transition={{ duration: 0.22 }}
              className="glass-card p-6 w-full max-w-sm flex flex-col items-center gap-5"
            >
              <h3 className="text-[color:var(--text-primary)] font-semibold text-base">
                Vista previa del avatar
              </h3>

              {/* Circular preview */}
              <div
                className="w-40 h-40 rounded-full overflow-hidden"
                style={{ boxShadow: "0 0 0 4px var(--accent)" }}
              >
                <img
                  src={avatarPreview.url}
                  alt="preview"
                  className="w-full h-full object-cover"
                />
              </div>

              <p className="text-xs text-[color:var(--text-muted)] text-center">
                Así se verá tu foto de perfil. La imagen se redimensionará automáticamente.
              </p>

              <div className="flex gap-3 w-full">
                <button
                  type="button"
                  onClick={cancelAvatarUpload}
                  disabled={avatarUploading}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium text-[color:var(--text-secondary)] hover:bg-white/5 transition-colors border border-white/10 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmAvatarUpload}
                  disabled={avatarUploading}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium btn-accent disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
                >
                  {avatarUploading ? "Subiendo..." : "Confirmar"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
