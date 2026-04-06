import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  // Skip auth token refresh if Supabase is not configured
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return NextResponse.next();
  }

  // Redirect OAuth code from root to /auth/callback
  // (Supabase PKCE flow sends code to Site URL, not redirectTo)
  const { pathname, searchParams } = request.nextUrl;
  if (pathname === "/" && searchParams.has("code")) {
    const callbackUrl = request.nextUrl.clone();
    callbackUrl.pathname = "/auth/callback";
    return NextResponse.redirect(callbackUrl);
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    // Only match page routes that need auth session refresh
    // Exclude: _next internals, static assets, API routes, public files
    "/((?!_next/static|_next/image|api/|favicon.ico|icon.svg|demo-photos/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|json|lottie)$).*)",
  ],
};
