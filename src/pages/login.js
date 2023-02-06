import React from 'react'
import Layout from '@/components/Layout'
import Card from '@/components/Card'
import Link from 'next/link'
import { useSupabaseClient } from "@supabase/auth-helpers-react";
import { useSession } from "@supabase/auth-helpers-react";


function LoginPage() {
  const session = useSession();
  
  const supabase = useSupabaseClient();
  async function loginWithGoogle() {

    await supabase.auth.signInWithOAuth({
      provider: 'google'
    })
    
  }
  const seesession = ()=>{
    console.log('estoy en login')
    console.log(session)
  } 
  return (
    <Layout hiddenNav={true} >
      <div className='mx-auto max-w-sm text-center'>
        <h1 className='text-white font-bold text-3xl py-8'>Iniciar Sesión</h1>
        <Link href='/' onClick={loginWithGoogle} className='hover:opacity-80 hover:scale-120 transition-all'>
          <Card >
            <div className='flex gap-3 items-center my-3 justify-center '>
            <svg xmlns="http://www.w3.org/2000/svg" className='h-8' viewBox="0 0 488 512"><path d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"/></svg>
            Iniciar Sesión con Google
            </div>
          </Card>
        </Link>
        <Link href='/profile' className='hover:opacity-80 hover:scale-120 transition-all'>
          <Card>
            <div className='flex gap-3 items-center my-3 justify-center '>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" className='h-8'><path d="M504 256C504 119 393 8 256 8S8 119 8 256c0 123.78 90.69 226.38 209.25 245V327.69h-63V256h63v-54.64c0-62.15 37-96.48 93.67-96.48 27.14 0 55.52 4.84 55.52 4.84v61h-31.28c-30.8 0-40.41 19.12-40.41 38.73V256h68.78l-11 71.69h-57.78V501C413.31 482.38 504 379.78 504 256z"/></svg>
            
            Iniciar Sesión con Facebook
            </div>
          </Card>
        </Link>
      </div>
    </Layout>
  )
}

export default LoginPage