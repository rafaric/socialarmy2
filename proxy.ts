import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|assets).*)"],
};

export async function proxy(request: Request) {
  const url = new URL(request.url);
  const response = NextResponse.next();

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            const cookieHeader = request.headers.get("cookie") ?? "";
            if (!cookieHeader) return [];
            return cookieHeader.split(";").map((c) => {
              const [name, ...rest] = c.trim().split("=");
              return { name, value: rest.join("=") };
            });
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options);
            });
          },
        },
      }
    );

    const { data, error } = await supabase.auth.getUser();
    const user = data.user;

    // No autenticado + ruta protegida → login
    if (!user && !url.pathname.startsWith("/login")) {
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }

    // Autenticado + /login → home
    if (user && url.pathname.startsWith("/login")) {
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
  } catch (err) {
    console.error("[proxy] Error:", err);
  }

  return response;
}