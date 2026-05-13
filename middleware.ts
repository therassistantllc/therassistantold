/**
 * Next.js Edge Middleware — API Authentication Gate
 *
 * Protects all /api/* routes by verifying a valid Supabase session exists.
 * Reads the Supabase auth token from cookies and validates with the Supabase
 * REST auth endpoint.
 *
 * Public exceptions (unauthenticated access allowed):
 *   - /api/auth/*          — sign-in, refresh, etc.
 *   - /api/health          — liveness probe
 *   - /api/organizations/create — first-run org setup (protected at route level)
 */

import { NextRequest, NextResponse } from "next/server";

// Routes that don't require a valid session
const PUBLIC_API_PREFIXES = ["/api/auth/", "/api/health"];
const PUBLIC_API_EXACT = new Set(["/api/organizations/create"]);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only guard API routes
  if (!pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Allow public routes through without auth
  if (
    PUBLIC_API_EXACT.has(pathname) ||
    PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  ) {
    return NextResponse.next();
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // Supabase not configured — allow through so the route can return a 503
    return NextResponse.next();
  }

  // Extract access token from Supabase cookie or Authorization header
  const authHeader = request.headers.get("authorization");
  let accessToken: string | null = null;

  if (authHeader?.startsWith("Bearer ")) {
    accessToken = authHeader.slice(7);
  } else {
    // Supabase stores the session in a cookie named `sb-<project-ref>-auth-token`
    // Try any cookie whose name contains "-auth-token" (matches all project refs)
    for (const [name, value] of request.cookies) {
      if (name.includes("-auth-token")) {
        try {
          const parsed = JSON.parse(decodeURIComponent(value)) as { access_token?: string };
          if (parsed.access_token) {
            accessToken = parsed.access_token;
          }
        } catch {
          // Cookie may be a raw JWT for some Supabase versions
          if (value.split(".").length === 3) {
            accessToken = value;
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
    return NextResponse.json({ error: "Authentication service unavailable" }, { status: 503 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
