import Layout from '@/components/Layout'
import PostCard from '@/components/PostCard'
import React from 'react'

function SavedPostPage() {
  return (
    <Layout>
      <h1 className='text-2xl uppercase font-bold text-white mb-6'>
        Posts guardados
      </h1>
      <PostCard />
      <PostCard />
    </Layout>
  )
}

export default SavedPostPage