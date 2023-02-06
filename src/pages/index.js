
import Layout from "@/components/Layout";
import PostCard from "@/components/PostCard";
import PostFormCard from "@/components/PostFormCard";
import { useSession } from "@supabase/auth-helpers-react";
import { useEffect } from "react";
import { useState } from "react";
import LoginPage from "./login";
import { useSupabaseClient} from '@supabase/auth-helpers-react'
import { UserContext } from "@/contexts/UserContext";

export default function Home() {
  const supabase = useSupabaseClient();
  const [posts, setPosts] = useState([]);
  const session = useSession();
  const [profile, setProfile] = useState(null);

  useEffect(() =>{
    fetchPosts();
  },[])

  useEffect(()=>{
    
    if(!session?.user?.id){
      return;
    }
    supabase.from('profiles').select().eq('id',session.user.id)
    .then(result =>{
      if (result.data.length){
        setProfile(result.data[0]);
      }
      //console.log(result.data[0]);
    })
  }, [session?.user?.id])

  const fetchPosts = () =>{
    supabase.from('posts').select('id, content, created_at, photos, profiles(id, name, avatar)')
    .order('created_at',{ascending:false}).then(result =>{
      setPosts(result.data)
    })
  }
  if(!session){
    return <LoginPage />
  }
  return (
    <>
      <Layout>
        <UserContext.Provider value={{profile: profile}}>

          <PostFormCard onPost={fetchPosts}/>
          {posts?.map(post => (

            <PostCard key={post.created_at} {...post}/>
            

          ))}
        </UserContext.Provider>
      </Layout>
    </>
  )
}
