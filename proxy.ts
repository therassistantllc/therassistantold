/**
 * Next.js 16 Proxy (replaces deprecated middleware.ts)
 *
 * Protects all /api/* routes by verifying a valid Supabase session.
 * Reads the access token from the Authorization header or Supabase auth cookie
 * and validates it against the Supabase auth endpoint.
 *
 * Public exceptions (unauthenticated access allowed):
 *   - /api/auth/*          — sign-in, refresh, etc.
 *   - /api/health          — liveness probe
 *   - /api/organizations/create — first-run org setup (guarded at route level)
 */

import { NextRequest, NextResponse } from "next/server";

// Routes that don't require a valid session
const PUBLIC_API_PREFIXES = ["/api/auth/", "/api/health"];
const PUBLIC_API_EXACT = new Set(["/api/organizations/create"]);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only guard API routes
  if (!pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Allow explicitly public routes through
  if (
    PUBLIC_API_EXACT.has(pathname) ||
    PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  ) {
    return NextResponse.next();
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // Supabase not configured — allow through so the route handler can return 503
    return NextResponse.next();
  }

  // Extract access token from Authorization header or Supabase session cookie
  let accessToken: string | null = null;

  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    accessToken = authHeader.slice(7);
  } else {
    // Supabase stores the session in a cookie named `sb-<project-ref>-auth-token`
    // or chunked as `sb-<ref>-auth-token.0`, `sb-<ref>-auth-token.1`, etc.
    for (const cookie of request.cookies.getAll()) {
      if (cookie.name.includes("-auth-token") && !cookie.name.match(/\.\d+$/)) {
        try {
          const parsed = JSON.parse(decodeURIComponent(cookie.value)) as { access_token?: string };
          if (parsed.access_token) {
            accessToken = parsed.access_token;
          }
        } catch {
          // Cookie value may be a raw JWT in some Supabase versions
          if (cookie.value.split(".").length === 3) {
            accessToken = cookie.value;
          }
        }
        break;
      }
    }
  }

  if (!accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Validate the token with Supabase
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: supabaseAnonKey,
      },
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
  } catch {
    // Network error validating token — fail closed
    return NextResponse.json(
      { error: "Authentication service unavailable" },
      { status: 503 },
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
