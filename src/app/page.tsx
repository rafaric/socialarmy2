"use client";

import { useState } from "react";
import Layout from "@/components/Layout";
import { useAuthStore } from "@/store/useAuthStore";
import { useProfile } from "@/hooks/useProfile";
import { usePosts } from "@/hooks/usePosts";
import PostsCard from "@/components/PostsCard";
import PostForm from "@/components/PostForm";
import ReactPaginate from "react-paginate";
import type { Post } from "@/types";

function PaginatedItems({ items, itemsPerPage }: { items: Post[]; itemsPerPage: number }) {
  const [itemOffset, setItemOffset] = useState(0);
  const currentItems = items.slice(itemOffset, itemOffset + itemsPerPage);
  const pageCount = Math.ceil(items.length / itemsPerPage);

  return (
    <>
      <div className="scale-up-center">
        {currentItems.map((post) => <PostsCard key={post.id} {...post} />)}
      </div>
      <ReactPaginate
        breakLabel="..."
        nextLabel=">"
        previousLabel="<"
        onPageChange={(ev) => setItemOffset((ev.selected * itemsPerPage) % items.length)}
        pageRangeDisplayed={5}
        pageCount={pageCount}
        renderOnZeroPageCount={null}
        activeClassName="active"
        className="flex bg-gray-300 gap-4 justify-center rounded-md mb-4 py-4"
        pageClassName="bg-purple-800 text-white w-6 text-center rounded-md hover:bg-purple-500"
        previousClassName="box-border hover:border-b hover:border-purple-800"
        nextClassName="box-border hover:border-b hover:border-purple-800"
      />
    </>
  );
}

export default function Home() {
  const { user } = useAuthStore();
  const { data: profile } = useProfile(user);
  const { data: posts = [], isLoading } = usePosts();

  return (
    <Layout>
      <PostForm profile={profile ?? null} />
      {isLoading ? (
        <p className="text-center text-gray-400 py-8">Cargando posts...</p>
      ) : (
        <PaginatedItems items={posts} itemsPerPage={5} />
      )}
    </Layout>
  );
}
