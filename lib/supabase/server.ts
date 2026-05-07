// File: lib/supabase/server.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export function createServerSupabaseAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const apiKey = serviceRole ?? anonKey;

  if (!url || !apiKey) {
    return null;
  }

  return createClient(url, apiKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function createServerSupabaseAdminClientTyped(): SupabaseClient<Database> | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const apiKey = serviceRole ?? anonKey;

  if (!url || !apiKey) {
    return null;
  }

  return createClient<Database>(url, apiKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
