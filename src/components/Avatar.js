import React from 'react'

function Avatar({size, url}) {
  let width ='w-12 hover:opacity-70'
  //const avatar = url;
  if(size ==='lg'){
    width = 'w-28';
  }
  //console.log(avatar)
  return (
    <div><div className={`${width} rounded-full overflow-hidden flex cursor-pointer `}>
    <img src={url} />
  </div></div>
  )
}

export default Avatar