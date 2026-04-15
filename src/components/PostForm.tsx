import { useEffect, useState } from "react";
import Avatar from "./Avatar";
import FriendSelector from "./FriendSearch";
import Link from "next/link";
import { useAuthStore } from "@/store/useAuthStore";
import { useFriends } from "@/hooks/useFriends";
import { useCreatePost, useUploadPhotos } from "@/hooks/usePosts";
import type { Profile, Photo, TaggedFriend } from "@/types";

interface PostFormProps {
  profile: Profile | null;
}

const PostForm = ({ profile }: PostFormProps) => {
  const { user, session } = useAuthStore();
  const { data: friends = [] } = useFriends(user);
  const createPost = useCreatePost();
  const uploadPhotos = useUploadPhotos();

  const [showModal, setShowModal] = useState(false);
  const [content, setContent] = useState("");
  const [uploads, setUploads] = useState<Photo[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<TaggedFriend[]>([]);
  const [amigos, setAmigos] = useState(false);

  const isUploading = uploadPhotos.isPending;

  async function handlePublish() {
    if (!user) return;
    await createPost.mutateAsync({ userId: user, content, uploads, selectedFriends, friends });
    setShowModal(false);
    setContent("");
    setUploads([]);
    setSelectedFriends([]);
  }

  async function handleFileChange(ev: React.ChangeEvent<HTMLInputElement>) {
    if (!ev.target.files?.length) return;
    const newPhotos = await uploadPhotos.mutateAsync(ev.target.files);
    setUploads((prev) => [...prev, ...newPhotos]);
  }

  return (
    <div className="flex flex-col bg-gray-100 border border-gray-300 rounded-lg p-4 mb-6">
      <div className="flex items-center">
        <Link href={`/profile/${profile?.id}`}>
          <Avatar url={profile?.avatar ?? `https://api.multiavatar.com/${profile?.name}.svg`} />
        </Link>
        <div className="flex flex-col justify-between flex-1">
          <p className="px-4 text-xl font-bold py-3">
            Bienvenido/a {profile?.name?.split(" ", 1)}!!!
          </p>
          <input
            className="w-full rounded-full px-4 py-2 mb-4 border border-gray-300 text-gray-700 leading-tight focus:outline-none cursor-pointer"
            type="text"
            placeholder="¿En qué estás pensando?"
            onClick={() => setShowModal(true)}
            readOnly
          />
        </div>
      </div>

      {showModal && (
        <div className="fixed top-0 left-0 w-full h-full bg-gray-800 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 min-w-fit relative text-center max-w-full">
            <p className="text-lg font-bold text-purple-700">Crear publicación</p>
            <button type="button" className="absolute top-8 right-2 hover:bg-purple-200 py-1 px-3 rounded-full cursor-pointer transition-all duration-700" onClick={() => setShowModal(false)}>
              X
            </button>
            <div className="flex flex-col items-center my-4 gap-4 border-t-2 border-purple-400 pt-2">
              <div className="flex items-start py-4 gap-4">
                <Avatar url={profile?.avatar} size="sm" />
                <p>{profile?.name}</p>
              </div>
              <div className="flex-1">
                <textarea
                  rows={6} cols={50}
                  className="w-full rounded-md px-2 py-2 border border-gray-300 text-gray-700 leading-tight focus:outline-none"
                  placeholder="¿En qué estás pensando?"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                />
              </div>
            </div>

            {uploads.length > 0 && (
              <div className="inline-flex items-center gap-2">
                {uploads.map((upload) => (
                  <div key={upload.id}>
                    {upload.tipo === "image/jpeg" && <img src={upload.url} alt="up" className="w-28 h-24 rounded-md" />}
                    {upload.tipo === "video/mp4" && <video className="w-28 h-24 rounded-md"><source src={upload.url} /></video>}
                  </div>
                ))}
                {isUploading && <span className="loader" />}
              </div>
            )}

            <div className="flex mt-4 justify-between">
              <div className="flex items-center gap-2">
                <label htmlFor="images" className="cursor-pointer">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                  </svg>
                  <input id="images" type="file" accept=".jpg,.gif,.mp4,.webm" className="hidden" onChange={handleFileChange} multiple />
                </label>
                <button type="button" onClick={() => setAmigos(!amigos)}>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
                {amigos && (
                  <FriendSelector
                    onSelect={setSelectedFriends}
                    selectedFriends={selectedFriends}
                    setSelectedFriends={setSelectedFriends}
                  />
                )}
              </div>
              <button
                type="button"
                className="bg-purple-600 text-white rounded-full px-4 py-2 disabled:opacity-50"
                onClick={handlePublish}
                disabled={createPost.isPending || !content.trim()}
              >
                {createPost.isPending ? "Publicando..." : "Publicar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PostForm;
