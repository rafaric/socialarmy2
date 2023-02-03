import React from 'react'

function Avatar({size}) {
  let width ='w-12 hover:opacity-70'
  if(size ==='lg'){
    width = 'w-28';
  }
  return (
    <div><div className={`${width} rounded-full overflow-hidden flex cursor-pointer `}>
    <img src='https://images.unsplash.com/photo-1633332755192-727a05c4013d?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=580&q=80' alt='avatar' />
  </div></div>
  )
}

export default Avatar