import Avatar from '@/components/Avatar'
import Card from '@/components/Card'
import Layout from '@/components/Layout'
import React from 'react'
import Link from 'next/link';
import PostCard from '@/components/PostCard';
import {useRouter} from 'next/router';
import FriendInfo from '@/components/FriendInfo';

function ProfilePage() {
  const {asPath} = useRouter();
  const isPosts = asPath.includes('posts') || asPath === '/profile';
  const isAbout = asPath.includes('about');
  const isFriends = asPath.includes('friends');
  const isPhoto = asPath.includes('photo');
  const activetab = 'sm:text-sm flex gap-2 px-2 py-2 hover:bg-purple-200 transition-all hover:rounded-md border-b-4 border-purple-800';
  const nonActiveTab = 'flex gap-2 px-2 py-2 hover:bg-purple-200 transition-all hover:rounded-md';



  return (
    <Layout>
      <Card noPadding={true} >
        <div className='relative'>
          <div className='h-36 overflow-hidden flex justify-center items-center'>
            <img src='https://images.unsplash.com/photo-1503152394-c571994fd383?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=870&q=80' />
          </div>
          <div className='absolute top-[70px] left-3'>
            <Avatar size={'lg'} />
          </div>
          <div className='py-2 px-4 pb-8'>
              <div className='ml-28' >
                <h1 className='text-2xl font-bold'>Rafael Ricardo Strongoli</h1>
                <div className='text-sm text-gray-500 leading-4 '>Resistencia, Argentina</div>
              </div>
          </div>
          
          <div className='pl-5 flex pb-5 items-center gap-4'>
            <div>
              <Link href='/profile/posts' className={isPosts ? activetab : nonActiveTab} onClick={()=> isPosts}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
                <span className='hidden md:block'>Posts</span>
              </Link>
            </div>
            <div>
              <Link href='/profile/about' className={isAbout ? activetab : nonActiveTab}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z" />
                </svg>
                <span className='hidden md:block'>About</span></Link>
            </div>
            <div>
              <Link href='/profile/friends' className={isFriends ? activetab : nonActiveTab}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                </svg>
                <span className='hidden md:block'>Friends</span></Link>
            </div>
            <div >
              <Link href='/profile/photos' className={isPhoto ? activetab : nonActiveTab}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
              <span className='hidden md:block'>Fotos</span></Link>
            </div>
          </div>
        </div>
      </Card>
      {isPosts && <PostCard />}
      {isAbout && (
        <Card>
          <h2 className='text-3xl font-bold py-5'>Acerca de mi</h2>
          <p className='text-gray-600 leading-6 pb-2'>Exercitation ex ipsum deserunt culpa velit laboris laborum aute laborum sint officia dolor. Aliquip quis ut voluptate consequat amet officia ipsum consequat eu sunt. Deserunt in eiusmod qui sunt. Ex exercitation labore sit sit labore veniam velit aute labore sit esse qui. Voluptate magna cillum laborum quis cillum elit magna cillum et enim pariatur ut duis. Tempor sint et sint minim sint mollit culpa consectetur in eiusmod.</p>
          <p className='text-gray-600 leading-6 pb-2'>Ex ipsum eu consectetur id ea ex duis fugiat sit non dolore officia aliqua. Dolor cillum do cupidatat occaecat nulla commodo tempor dolore sunt id. Adipisicing ullamco incididunt sunt laboris veniam.</p>
        </Card>
      )}
      {isFriends && (
        <Card>
          <h2 className='text-3xl font-bold py-5'>Amigos</h2>
          <div className='grid md:grid-cols-2'>
            <FriendInfo  />
            <FriendInfo />
            <FriendInfo />
            <FriendInfo />
            <FriendInfo />
            <FriendInfo />
          </div>
        </Card>
      )}
      {isPhoto && (
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
    </Layout>
  )
}

export default ProfilePage