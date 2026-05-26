/**
 * GET /api/auth/me
 * Returns the current authenticated user's context
 * (staffId, organizationId, roles, permissions)
 *
 * Example: Call from client to load user context on app startup
 */

import { NextResponse } from "next/server";
import { requireAuthentication } from "@/lib/rbac/middleware";
import { getAuthenticatedUser, getProviderIdForUser } from "@/lib/rbac/auth";
import { createServerSupabaseAdminClient } from "@/lib/supabase/server";

export async function GET() {
  const contextOrError = await requireAuthentication();

  if (contextOrError instanceof NextResponse) {
    return contextOrError;
  }

  const { staffId, organizationId, email, firstName, lastName, roles, permissions } = contextOrError;

  const authUser = await getAuthenticatedUser();
  const providerId = authUser
    ? await getProviderIdForUser(authUser.userId, organizationId)
    : null;

  let organizationName: string | null = null;
  const supabase = createServerSupabaseAdminClient();
  if (supabase && organizationId) {
    const { data } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", organizationId)
      .maybeSingle();
    organizationName = (data as { name?: string | null } | null)?.name ?? null;
  }

  return NextResponse.json({
    staffId,
    organizationId,
    organizationName,
    email,
    firstName,
    lastName,
    roles,
    permissions,
    providerId,
  });
}
