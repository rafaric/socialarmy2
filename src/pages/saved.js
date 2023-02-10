import Layout from '@/components/Layout'
import PostCard from '@/components/PostCard';
import {useSession, useSupabaseClient} from '@supabase/auth-helpers-react'
import React, { useState, useEffect } from 'react'

function SavedPostPage() {
  const [posts, setPosts] = useState([]);
  const session = useSession();
  const supabase = useSupabaseClient();
  useEffect(() => {
    if(!session?.user.id){
      return;
    }
    supabase.from('saved_posts')
    .select('*, profiles(*)')
    .eq('user_id', session.user.id)
    .then(result => setPosts(result.data))
  }, []);
  return (
    <Layout>
      <h1 className='text-2xl uppercase font-bold text-white mb-6'>
        Posts guardados
      </h1>
      {posts?.length > 0 && posts.map(post => (
        <div key={post.id}>
          <PostCard {...post}/>
        </div>
      )

      )}
    </Layout>
  )
}

export default SavedPostPage