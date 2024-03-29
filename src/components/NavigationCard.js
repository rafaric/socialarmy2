import React from "react";
import Card from "./Card";
import Link from "next/link";
import { useRouter } from "next/router";
import { useSession, useSupabaseClient } from "@supabase/auth-helpers-react";

function NavigationCard() {
  const router = useRouter();
  const { pathname, asPath } = router;
  const activeElement =
    "flex md:gap-3 md:mx-0 py-4 bg-purple-500 text-white md:-mx-10 md:px-8 px-4 rounded-md shadow-lg shadow-purple-400 box-border";
  const hoveredElement =
    "flex md:gap-3 md:mx-0 py-4 hover:bg-purple-200/50 md:-mx-2 md:px-2 px-4  hover:-mx-4 hover:justify-center rounded-md hover:shadow-md hover:transition-all hover:duration-300 hover:scale-105 transition-all duration-300";
  const supabase = useSupabaseClient();
  const session = useSession();

  async function signout() {
    const { error } = await supabase.auth.signOut();
    console.log(error);
  }
  return (
    <>
      <Card>
        <div className="flex md:block justify-center ">
          <h2 className="hidden md:visible text-gray-400 font-bold md:text-center md:pt-3">
            Menú
          </h2>
          <Link
            className={pathname === "/" ? activeElement : hoveredElement}
            href="/"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-6 h-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
              />
            </svg>
            <span className="hidden md:block">Home</span>
          </Link>
          <Link
            className={
              asPath === `/profile/${session?.user.id}#friends`
                ? activeElement
                : hoveredElement
            }
            href={`/profile/${session?.user.id}?tab=friends`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-6 h-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"
              />
            </svg>
            <span className="hidden md:block">Amigos</span>
          </Link>
          <Link
            className={pathname === "/saved" ? activeElement : hoveredElement}
            href="/saved"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-6 h-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z"
              />
            </svg>
            <span className="hidden md:block">Guardados</span>
          </Link>
          <Link
            className={
              pathname === "/notifications" ? activeElement : hoveredElement
            }
            href="/notifications"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-6 h-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0M3.124 7.5A8.969 8.969 0 015.292 3m13.416 0a8.969 8.969 0 012.168 4.5"
              />
            </svg>
            <span className="hidden md:block">Notificaciones</span>
          </Link>

          <Link
            className={pathname === "/logout" ? activeElement : hoveredElement}
            href="/"
            onClick={signout}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-6 h-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"
              />
            </svg>
            <span className="hidden md:block">Logout</span>
          </Link>
        </div>
      </Card>
    </>
  );
}

export default NavigationCard;
