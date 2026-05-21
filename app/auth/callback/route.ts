import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Magic-link callback. Exchanges the one-time `code` for a session and sets
 * the session cookies on the redirect response.
 *
 * Why not use the shared lib/supabase/server.ts client here: in Next.js
 * App Router route handlers, cookies written via `cookies().set()` are not
 * always attached to a freshly-constructed NextResponse.redirect() response.
 * Writing the Supabase cookies directly on the response we're about to
 * return is the reliable pattern — see Supabase's @supabase/ssr docs.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  // Build the redirect we'll return on success; Supabase will hang the
  // session cookies on this exact object.
  const response = NextResponse.redirect(`${origin}${next}`);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.headers
            .get("cookie")
            ?.split(";")
            .map((c) => c.trim())
            .filter(Boolean)
            .map((c) => {
              const eq = c.indexOf("=");
              if (eq < 0) return { name: c, value: "" };
              return { name: c.slice(0, eq), value: decodeURIComponent(c.slice(eq + 1)) };
            }) ?? [];
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`
    );
  }

  return response;
}
