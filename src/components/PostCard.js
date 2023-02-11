import React, { useEffect } from 'react';
import { useContext } from 'react';
import Link from 'next/link';
import { useState } from 'react';
import Avatar from './Avatar';
import Card from './Card';
import ClickAwayListener from 'react-click-away-listener'
import ReactTimeAgo from 'react-time-ago'
import { UserContext } from '@/contexts/UserContext';
import { useSupabaseClient } from '@supabase/auth-helpers-react'


function PostCard({id, content,created_at,photos, profiles:authorProfile}) {
  const [isOpen, setIsOpen] = useState(false);
  const [likes, setLikes] = useState([]);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [savedPost, setSavedPost] = useState(false);
  const supabase = useSupabaseClient();
  const onClickAway = () =>{
    setIsOpen(false);
  }
  const {profile:myprofile}  = useContext(UserContext);
  const isLikesByMe = !!likes?.find(like => like.user_id === myprofile?.id);
  
  function toggleLike (){
    if(isLikesByMe){
      supabase.from('likes').delete()
      .eq('post_id', id)
      .eq('user_id', myprofile.id)
      .then(() => {
        fetchLikes();
      });
      
      return;
    }
    supabase.from('likes').insert({
      post_id: id,
      user_id: myprofile.id
    })
    .then(() =>{
      fetchLikes();
    })
  }
  
  function fetchIsSaved(){
    supabase.from('saved_posts')
    .select()
    .eq('post_id', id)
    .eq('user_id', myprofile?.id)
    .then(result=>{
      if(result?.data?.length > 0){
        setSavedPost(true);
      } else{
        setSavedPost(false);
      }
    })
  }
  function fetchLikes(){
    supabase.from('likes').select()
  .eq('post_id', id)
  .then(result => setLikes(result.data))
  }

  function fetchComments(){
    supabase.from('posts')
    .select('*, profiles(*)')
    .eq('parent', id)
    .then(result => setComments(result.data))
  }
  function toggleSave(){
    console.log('estoy aqui')
    if(savedPost){
      supabase.from('saved_posts')
      .delete()
      .eq('post_id', id).eq('user_id', myprofile.id)
      .then(() =>{
        setIsOpen(false);
        setSavedPost(false);
      })
    }
    if(!savedPost){
      supabase.from('saved_posts')
      .insert({
        user_id:myprofile?.id,
        post_id:id
      })
      .then(()=>{
        setSavedPost(true)
        setIsOpen(false);
        
      }
      )
    }
  }

  useEffect(() => {
    fetchLikes();
    fetchComments();
    fetchIsSaved();
  }, []);
  
  function postComment(ev) {
    ev.preventDefault();
    supabase.from('posts')
      .insert({
        content:commentText,
        author:myprofile.id,
        parent:id,
      })
      .then(result => {
        console.log(result);
        fetchComments();
        setCommentText('');
      })
  }

  return (
    <Card className="">
      <div className='flex relative'>
        <Link className='cursor-pointer hover:opacity-70' href={'/profile'}><Avatar url={authorProfile?.avatar} /></Link>
        <div className='grow pl-4 '>
          <p><Link href={'/profile/'+authorProfile?.id} className='font-semibold hover:underline cursor-pointer hover:text-purple-300'>
          {authorProfile?.name}</Link> ha compartido un post</p>
          <p className='font-light text-gray-400 text-xs'><ReactTimeAgo date={ (new Date(created_at)).getTime()}/></p>
        </div>
        <button className='text-gray-400' onClick={()=> setIsOpen(true)}>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
          </svg>
        </button>
        {isOpen && 
          <ClickAwayListener onClickAway={onClickAway}>
            <div className='absolute top-9 bg-white rounded-md border p-3 gap-2 right-1 flex flex-col shadow-lg shadow-purple-200 z-10'>
              <a onClick={toggleSave} className='flex gap-2 py-2 hover:bg-purple-200/50 -mx-2 px-2  hover:cursor-pointer hover:py-2 rounded-md hover:shadow-md transition-all hover:scale-105'>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
                </svg>
                {savedPost ? 'Quitar' : 'Guardar Post'}
                </a>
              <a className='flex gap-2 py-2 hover:bg-purple-200/50 -mx-2 px-2 hover:cursor-pointer  hover:py-2 rounded-md hover:shadow-md transition-all hover:scale-105'>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
  <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0M3.124 7.5A8.969 8.969 0 015.292 3m13.416 0a8.969 8.969 0 012.168 4.5" />
</svg>

              Activar Notificaciones</a>
              <a className='flex gap-2 py-2 hover:bg-purple-200/50 -mx-2 px-2 hover:cursor-pointer  hover:py-2 rounded-md hover:shadow-md transition-all hover:scale-105'><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
  <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5" />
</svg>
              Reportar</a>
              <a className='flex gap-2 py-2 hover:bg-purple-200/50 -mx-2 px-2 hover:cursor-pointer  hover:py-2 rounded-md hover:shadow-md transition-all hover:scale-105'>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
</svg>
Borrar</a>
            </div>
          </ClickAwayListener>
        }
        
      </div>
      <div>
        <p className='px-1 py-5 text-sm'>{content}</p>
        {photos?.length > 0 && (
          <div className="flex gap-4">
          {photos.map(photo => (
            <div className='h-36 w-auto rounded-md overflow-hidden' key={photo}>
              <img src={photo} className='h-36' alt=''/>
            </div>
          ))}
          </div>
        )}
        {/* <div className='rounded-md overflow-hidden'>
          <img src='https://images.unsplash.com/photo-1530841377377-3ff06c0ca713?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=870&q=80' alt=''/>
        </div> */}
      </div>
      <div className='flex mt-3 gap-5'>
        <button className='flex gap-2 items-center' onClick={toggleLike}>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={"w-6 h-6 "+(isLikesByMe? "fill-purple-500" : "")}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
          </svg>
          {likes?.length}
        </button>
        <button className='flex gap-2 items-center'>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
          </svg>
          {comments?.length}
        </button>
        <button className='flex gap-2 items-center'>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
          </svg>
          4
        </button>
      </div>

      <div className='inline-block min-w-[40%]'>
        {comments.length > 0 && comments.map(comment => (
          <div key={comment.content} className='min-w-[40%] items-center bg-purple-100 flex gap-4 rounded-full my-4 p-1 border border-purple-200'>
            <div className=''>
                <Avatar url={comment?.profiles.avatar} />
            </div>
            <div className='flex flex-col'>
              <div>
              <Link className='hover:underline hover:text-purple-500' href={'/profile/'+comment.profiles.id}>
              {comment.profiles.name}
              </Link><span className='text-gray-400 text-sm'> - <ReactTimeAgo timeStyle={'twitter'} date={ (new Date(comment.created_at)).getTime()}/></span>
              </div>
              <p className='text-gray-500 italic'>
              {comment.content}
              </p>  
            </div>
          </div>
        ))}
      </div>
      <div className='flex mt-3 gap-4'>
        <div className=''>
          <Avatar url={myprofile?.avatar}/>
        </div>
        <div className='relative border grow rounded-full'>
          <form onSubmit={postComment}>
            <input className='block w-full p-3 overflow-hidden h-12 rounded-full' 
                  placeholder='Deja un comentario...'
                  value={commentText}
                  onChange={ev=>setCommentText(ev.target.value)}
                  />
          </form>
          <button className='absolute right-4 top-3 text-gray-400'>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
          </button>
        </div>
      </div>
    </Card>
  )
}

export default PostCard