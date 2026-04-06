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

  return await updateSession(request);
}

export const config = {
  matcher: [
    // Only match page routes that need auth session refresh
    // Exclude: _next internals, static assets, API routes, public files
    "/((?!_next/static|_next/image|api/|favicon.ico|icon.svg|demo-photos/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|json|lottie)$).*)",
  ],
};
