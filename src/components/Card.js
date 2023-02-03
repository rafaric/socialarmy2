import React from 'react'

function Card({children, noPadding}) {
  let classy = 'bg-white shadow-md shadow-purple-500 mb-5 rounded-md';
  if (!noPadding){
    classy += ' py-2 md:px-8 px-6';
  }

  return (
    <div className={classy}>
      {children}
    </div>
  )
}

export default Card