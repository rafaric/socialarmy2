import Layout from "@/components/Layout";
import PostsCard from "@/components/PostsCard";
import { useSession, useSupabaseClient } from "@supabase/auth-helpers-react";
import React, { useEffect, useState } from "react";

const Saved = () => {
  const [posts, setPosts] = useState([]);
  const session = useSession();
  const supabase = useSupabaseClient();

  useEffect(() => {
    if (!session?.user.id) {
      return;
    }
    supabase
      .from("saved_posts")
      .select("post_id")
      .eq("user_id", session?.user?.id)
      .then((result) => {
        const postsIds = result.data.map((item) => item.post_id);
        supabase
          .from("posts")
          .select("*, profiles(*)")
          .in("id", postsIds)
          .then((result) => setPosts(result.data));
      });
  }, [session?.user.id]);

  return (
    <Layout>
      <h1 className="text-2xl uppercase text-center font-bold text-white mb-6">
        Posts guardados
      </h1>
      {posts?.length > 0 &&
        posts.map((post) => (
          <div className="mx-4" key={post.id}>
            <PostsCard {...post} />
          </div>
        ))}
    </Layout>
  );
};

export default Saved;
