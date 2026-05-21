import { NextResponse, type NextRequest } from "next/server";

// Stub: proves whether the proxy itself runs cleanly on Vercel.
// If this still 500s, the problem is the proxy convention / runtime, not Supabase.
// If pages load, the Supabase/cookie code is what was crashing — we'll re-add it
// piece by piece. Auth gating is still enforced server-side in app/(app)/layout.tsx
// via requireProfile(), so this is safe as a diagnostic step.
export async function proxy(request: NextRequest) {
  console.log("[beacon] proxy hit:", request.nextUrl.pathname);
  return NextResponse.next({ request });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
