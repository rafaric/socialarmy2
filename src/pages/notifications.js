import Avatar from '@/components/Avatar'
import Card from '@/components/Card'
import Layout from '@/components/Layout'
import React from 'react'
import Link from 'next/link'

function NotificationsPage() {
  return (
    <Layout>
      <h1 className='text-2xl uppercase font-bold text-white mb-6'>
        Notificaciones
      </h1>
      <Card>
        <div className='flex flex-col gap-4'>
          <div className='flex items-center gap-3 py-2 border-b-2'>
            <Link href='/profile' className='hover:opacity-30'> <Avatar /></Link>
            <p><Link href='/profile' className='font-bold hover:text-purple-300'>Rafael Ricardo Strongoli</Link> Le ha dado me gusta a tu foto</p>
          </div>
          <div className='flex items-center gap-3 py-2 border-b-2'>
            <Link href='/profile' className='hover:opacity-30'> <Avatar /></Link>
            <p><Link href='/profile' className='font-bold hover:text-purple-300'>Rafael Ricardo Strongoli</Link> Le ha dado me gusta a tu foto</p>
          </div>
          <div className='flex items-center gap-3 py-2 border-b-2'>
            <Link href='/profile' className='hover:opacity-30'> <Avatar /></Link>
            <p><Link href='/profile' className='font-bold hover:text-purple-300'>Rafael Ricardo Strongoli</Link> Le ha dado me gusta a tu foto</p>
          </div>
          <div className='flex items-center gap-3 py-2 border-b-2'>
            <Link href='/profile' className='hover:opacity-30'> <Avatar /></Link>
            <p><Link href='/profile' className='font-bold hover:text-purple-300'>Rafael Ricardo Strongoli</Link> Le ha dado me gusta a tu foto</p>
          </div>
          <div className='flex items-center gap-3 py-2 border-b-2'>
            <Link href='/profile' className='hover:opacity-30'> <Avatar /></Link>
            <p><Link href='/profile' className='font-bold hover:text-purple-300'>Rafael Ricardo Strongoli</Link> Le ha dado me gusta a tu foto</p>
          </div>
          <div className='flex items-center gap-3 py-2 border-b-2'>
            <Link href='/profile' className='hover:opacity-30'> <Avatar /></Link>
            <p><Link href='/profile' className='font-bold hover:text-purple-300'>Rafael Ricardo Strongoli</Link> Le ha dado me gusta a tu foto</p>
          </div>
        </div>
      </Card>
    </Layout>
  )
}

export default NotificationsPage