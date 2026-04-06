import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Only match page routes that need auth session refresh
    // Exclude: _next internals, static assets, API routes, public files
    "/((?!_next/static|_next/image|api/|favicon.ico|icon.svg|demo-photos/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|json|lottie)$).*)",
  ],
};
