import React from 'react'
import Avatar from './Avatar'

function FriendInfo() {
  return (
    <div className='flex items-center gap-6 pb-2 mr-16 mb-5 border-b'>
      <Avatar />
      <div>
        <h3 className='font-bold'>Rafael Ricardo Strongoli</h3>
        <p className='text-sm text-gray-400'>5 amigos en común</p>
      </div>
    </div>
  )
}

export default FriendInfo