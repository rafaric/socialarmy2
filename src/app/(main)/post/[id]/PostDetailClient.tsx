"use client";

import { useRouter } from "next/navigation";
import PostsCard from "@/components/PostsCard";
import type { Photo, TaggedFriend } from "@/types";

interface PostDetailClientProps {
  post: {
    id: string;
    content: string;
    created_at: string;
    author: string;
    photos: Photo[] | null;
    tagged: unknown[] | null;
    era?: string | null;
    now_playing?: string | null;
    bts_members?: string[] | null;
    profiles: { id: string; name: string; avatar: string } | { id: string; name: string; avatar: string }[] | null;
  };
}

export default function PostDetailClient({ post }: PostDetailClientProps) {
  const router = useRouter();

  const authorProfile = Array.isArray(post.profiles)
    ? (post.profiles[0] ?? { id: post.author, name: "Usuario", avatar: "" })
    : (post.profiles ?? { id: post.author, name: "Usuario", avatar: "" });

  const tagged = post.tagged as TaggedFriend[] | null;

  return (
    <div>
      <button
        type="button"
        onClick={() => router.back()}
        className="flex items-center gap-2 text-sm text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)] transition-colors mb-5"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
          <path fillRule="evenodd" d="M11.03 3.97a.75.75 0 0 1 0 1.06l-6.22 6.22H21a.75.75 0 0 1 0 1.5H4.81l6.22 6.22a.75.75 0 1 1-1.06 1.06l-7.5-7.5a.75.75 0 0 1 0-1.06l7.5-7.5a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
        </svg>
        Volver
      </button>

      <PostsCard
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
    </div>
  );
}
