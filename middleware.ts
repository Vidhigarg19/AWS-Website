import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Root middleware — first layer of protection for the admin and media areas.
 *
 *   /admin/*       → not signed in: redirect to /login
 *   /api/admin/*   → not signed in: 401 JSON (a redirect makes no sense for an API)
 *   /media/*       → not signed in: redirect to /media/login   (/media/login itself is public)
 *   /api/media/*   → not signed in: 401 JSON
 *
 * IMPORTANT: this layer only answers "is someone signed in?". It does NOT
 * decide who may do what. Every /api/admin/* handler must still call
 * requireAdmin() and every /api/media/* handler requireRole()
 * (lib/auth/*), and the layouts check the role too. Never rely on
 * middleware alone for authorization.
 *
 * All other routes pass through unmodified.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAdminApi = pathname.startsWith("/api/admin");
  const isAdminPage = pathname.startsWith("/admin");
  const isMediaApi = pathname === "/api/media" || pathname.startsWith("/api/media/");
  const isMediaLogin = pathname === "/media/login" || pathname.startsWith("/media/login/");
  const isMediaPage =
    (pathname === "/media" || pathname.startsWith("/media/")) && !isMediaLogin;

  const isProtectedApi = isAdminApi || isMediaApi;
  if (!isAdminPage && !isMediaPage && !isProtectedApi) {
    return NextResponse.next();
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (isProtectedApi) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 }
      );
    }

    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = isMediaPage ? "/media/login" : "/login";
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/admin/:path*",
    "/media/:path*",
    "/api/media/:path*",
  ],
};
