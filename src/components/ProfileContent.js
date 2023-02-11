import React, { useEffect, useState } from 'react'
import Card from './Card'
import FriendInfo from './FriendInfo'
import PostCard from './PostCard'
import { useSupabaseClient } from '@supabase/auth-helpers-react'


function ProfileContent({active, userId}) {
  const [posts, setPosts] = useState([]);
  const [profile, setProfile] = useState(null);
  const supabase = useSupabaseClient();
  useEffect(() => {
    if(!userId){
      return;
    }
    if (active==='posts'){
      loadPosts().then(() =>{

      });
    }
  }, [userId]);
  

  async function userPosts(userId){
    const {data} = await supabase
    .from('posts')
    .select('id, content, created_at, author')
    .is('parent', null)
    .eq('author', userId);
    return data;
  }
  async function userProfile(userId){
    const {data} = await supabase.from('profiles').select().eq('id', userId);
    return data[0];
  }
  
  async function loadPosts(){
    const posts = await userPosts(userId);
    const profile = await userProfile(userId);
    setPosts(posts);
    setProfile(profile);
  }

  return (
    <div>
      {active === 'posts' && (
        <div>
        {posts.length > 0 && posts.map(post => (
          <PostCard key={post.created_at} {...post} profiles={profile}/>
          ))
        }
        </div>
        )
      }
      {active ==='about' && (
        <Card>
          <h2 className='text-3xl font-bold py-5'>Acerca de mi</h2>
          <p className='text-gray-600 leading-6 pb-2'>Exercitation ex ipsum deserunt culpa velit laboris laborum aute laborum sint officia dolor. Aliquip quis ut voluptate consequat amet officia ipsum consequat eu sunt. Deserunt in eiusmod qui sunt. Ex exercitation labore sit sit labore veniam velit aute labore sit esse qui. Voluptate magna cillum laborum quis cillum elit magna cillum et enim pariatur ut duis. Tempor sint et sint minim sint mollit culpa consectetur in eiusmod.</p>
          <p className='text-gray-600 leading-6 pb-2'>Ex ipsum eu consectetur id ea ex duis fugiat sit non dolore officia aliqua. Dolor cillum do cupidatat occaecat nulla commodo tempor dolore sunt id. Adipisicing ullamco incididunt sunt laboris veniam.</p>
        </Card>
      )}
      {active ==='friends' && (
        <Card>
          <h2 className='text-3xl font-bold py-5'>Amigos</h2>
          <div className='grid md:grid-cols-2'>
            <FriendInfo />
            <FriendInfo />
            <FriendInfo />
            <FriendInfo />
            <FriendInfo />
            <FriendInfo />
          </div>
        </Card>
      )}
      {active === 'photos' && (
        <Card>
        <h2 className='text-3xl font-bold py-5'>Fotos</h2>
        <div className='grid md:grid-cols-2 gap-4'>

        <div className='rounded-md overflow-hidden flex items-center h-32 hover:opacity-50 cursor-pointer hover:shadow-md hover:translate-x-1 transition-all'>
          <img src='https://images.unsplash.com/photo-1603565816030-6b389eeb23cb?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=870&q=80' alt='1' />
        </div>
        <div className='rounded-md overflow-hidden flex items-center h-32 hover:opacity-50 cursor-pointer hover:shadow-md hover:translate-x-1 transition-all'>
          <img src='https://images.unsplash.com/photo-1603565816030-6b389eeb23cb?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=870&q=80' alt='1' />
        </div>
        <div className='rounded-md overflow-hidden flex items-center h-32 hover:opacity-50 cursor-pointer hover:shadow-md hover:translate-x-1 transition-all'>
          <img src='https://images.unsplash.com/photo-1603565816030-6b389eeb23cb?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=870&q=80' alt='1' />
        </div>
        <div className='rounded-md overflow-hidden flex items-center h-32 hover:opacity-50 cursor-pointer hover:shadow-md hover:translate-x-1 transition-all'>
          <img src='https://images.unsplash.com/photo-1603565816030-6b389eeb23cb?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=870&q=80' alt='1' />
        </div>
        <div className='rounded-md overflow-hidden flex items-center h-32 hover:opacity-50 cursor-pointer hover:shadow-md hover:translate-x-1 transition-all'>
          <img src='https://images.unsplash.com/photo-1603565816030-6b389eeb23cb?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=870&q=80' alt='1' />
        </div>
        <div className='rounded-md overflow-hidden flex items-center h-32 hover:opacity-50 cursor-pointer hover:shadow-md hover:translate-x-1 transition-all'>
          <img src='https://images.unsplash.com/photo-1603565816030-6b389eeb23cb?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=870&q=80' alt='1' />
        </div>
        <div className='rounded-md overflow-hidden flex items-center h-32 hover:opacity-50 cursor-pointer hover:shadow-md hover:translate-x-1 transition-all'>
          <img src='https://images.unsplash.com/photo-1603565816030-6b389eeb23cb?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=870&q=80' alt='1' />
        </div>
        </div>
        </Card>
      )}
    </div>
  )
}

export default ProfileContent