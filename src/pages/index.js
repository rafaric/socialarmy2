import LoginPage from "./login";
import { useSession, useSupabaseClient } from "@supabase/auth-helpers-react";
import Layout from "@/components/Layout";
import { useState, useContext, useEffect } from "react";
import { UserContext } from "@/contexts/UserContext";
import { fperfil, fposts, flikes, fFriends } from "@/utils/fperfil";
import PostsCard from "@/components/PostsCard";
import PostForm from "@/components/PostForm";
import Head from "next/head";
import ReactPaginate from "react-paginate";

export default function Home() {
  const session = useSession();
  const supabase = useSupabaseClient();
  const { profile, setProfile, posts, setPosts, refresh, setRefresh } =
    useContext(UserContext);

  useEffect(() => {
    fperfil(session?.user?.id, supabase, setProfile);
    fposts(supabase, setPosts);
  }, [session]);

  useEffect(() => {
    if (refresh) {
      fposts(supabase, setPosts);
      setRefresh(false);
    }
  }, [refresh]);

  if (!session) {
    return <LoginPage />;
  }
  function Posts({ currentItems }) {
    return (
      <div className="scale-up-center">
        {currentItems &&
          currentItems.map((post) => <PostsCard key={post.id} {...post} />)}
      </div>
    );
  }
  function PaginatedItems({ itemsPerPage }) {
    const [itemOffset, setItemOffset] = useState(0);
    const endOffset = itemOffset + itemsPerPage;
    const currentItems = posts.slice(itemOffset, endOffset);

    const pageCount = Math.ceil(posts?.length / itemsPerPage);
    console.log(currentItems);

    const handlePageClick = (ev) => {
      const newOffset = (ev.selected * itemsPerPage) % posts.length;
      setItemOffset(newOffset);
    };
    return (
      <>
        <Posts currentItems={currentItems} />
        <ReactPaginate
          breakLabel="..."
          nextLabel=">"
          onPageChange={handlePageClick}
          pageRangeDisplayed={5}
          pageCount={pageCount}
          previousLabel="<"
          renderOnZeroPageCount={null}
          activeClassName="active"
          className="flex bg-gray-300 gap-4  justify-center rounded-md mb-4 py-4 border-b-"
          pageClassName="bg-purple-800 text-white w-6 text-center rounded-md hover:bg-purple-500"
          previousClassName="box-border hover:border-b hover:border-purple-800"
          nextClassName="box-border hover:border-b hover:border-purple-800"
        />
      </>
    );
  }

  return (
    <Layout>
      <Head>
        <title>Social Army</title>
      </Head>
      <PostForm profile={profile} />

      <PaginatedItems itemsPerPage={5} />
    </Layout>
  );
}
