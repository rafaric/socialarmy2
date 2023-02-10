import React, { useState } from 'react'

import { useSupabaseClient, useSession } from '@supabase/auth-helpers-react'
import { BeatLoader } from 'react-spinners';

function Avatar({size, url, editable, onChange}) {
  const [isUploading, setIsUploading] = useState(false);
  const supabase = useSupabaseClient();
  const session = useSession();
  let width ='w-12 hover:opacity-70'
  //const avatar = url;
  if(size ==='lg'){
    width = 'w-36';
  }
  async function handleAvatarChange(ev) {
    const file = ev.target.files?.[0];
    if (file){
      setIsUploading(true);
      await updateUserProfileImage(supabase, session.user.id, file, 'avatars', 'avatar');
      setIsUploading(false);
      if (onChange) onChange();
    }

  }
  //console.log(avatar)
  return (
    <div className={` ${width} relative`}>
      <div className={`bg-red-500 rounded-full overflow-hidden flex cursor-pointer `}>
        <img src={url} alt={url} className='w-full'/>
      </div>
      {isUploading && <BeatLoader />}
      {editable && <label className='absolute bottom-0 right-2 rounded-full cursor-pointer hover:opacity-70'>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 bg-white rounded-full p-1 border border-purple-400">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
          </svg>
        <input type="file" className='hidden' onChange={handleAvatarChange} />
      </label>}
    </div>
  )
}

export default Avatar