import NavigationCard from "@/components/NavigationCard";


function Layout({children, hiddenNav}) {
  return (
    <>
      <div className='md:flex mt-4 w-full md:max-w-5xl mx-auto md:gap-7'>
        {!hiddenNav && <aside className="md:w-60 w-screen mx-auto">
          <NavigationCard/>
        </aside>}
        

        <main className='mx-5 md:mx-0 grow'>
          {children}
        </main>  
        
      </div>
    </>
  )
}

export default Layout